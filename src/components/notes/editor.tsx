"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { Markdown } from 'tiptap-markdown'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import GapCursor from '@tiptap/extension-gapcursor'
import Dropcursor from '@tiptap/extension-dropcursor'
import Focus from '@tiptap/extension-focus'
import { TrailingNode } from './trailing-node'
import * as Y from 'yjs'
import { z } from 'zod'
import { Loader2 } from "lucide-react"
import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommand, suggestionConfig } from './slash-command'
import { CalloutNode } from './callout-node'
import { NoteBubbleMenu } from './bubble-menu'
import { TableBubbleMenu } from './table-bubble-menu'
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useRef, useCallback, useMemo, useState, Component, type ReactNode } from 'react'
import { Editor } from '@tiptap/react'
import { useNotesStore } from "@/shared"
import {
  acquireYDoc,
  releaseYDoc,
  setActiveEdit,
  getPlainTextFromYDoc,
  markLocallyModified,
  waitForPersistence,
  applyRemoteUpdate,
} from "@/shared"
import { saveYDocToSupabase, loadYDocFromSupabase, triggerFlush } from "@/shared"
import { getLocalLastSeq, getNoteCrdtUpdates, setLocalLastSeq, toUint8Update, enqueueQueuedNoteCrdtUpdate } from "@/shared"
import { isNonRetryableError } from "@/shared"
import { useUserStore } from "@/shared"
import type { NoteContent } from "@/shared"
import { getEditorContentValue } from "@/shared"
import { sendNoteBroadcast } from "@/shared"
import { hlc } from "@/shared"
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import DOMPurify from 'dompurify'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
import styles from './editor-content.module.css'

const lowlight = createLowlight(common)

const SAVE_DEBOUNCE_MS = 800
const RETRY_DELAY_MS = 3000
const MAX_PERSIST_RETRIES = 3
const __DEV__ = process.env.NODE_ENV !== 'production'

const stashSchema = z.object({
  noteId: z.string(),
  opId: z.string().optional(),
  updateData: z.string(),
  snapshot: z.string().optional(),
  body: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  content: z.any().optional(),
  updatedAt: z.string().optional()
})

function containsFlutterTags(text: string): boolean {
  if (!text) return false
  if (/<(?:bold|code|italic|underline|link)>/i.test(text)) return true
  if (/<\/(?:bold|code|italic|underline|link)>/i.test(text)) return true
  return false
}

function convertCustomTagsToMarkdown(text: string): string {
  if (!text) return text

  let result = text

  result = result.replace(/<bold>([\s\S]*?)<\/bold>/gi, '**$1**')

  result = result.replace(/<italic>([\s\S]*?)<\/italic>/gi, '*$1*')

  result = result.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')

  result = result.replace(/<underline>([\s\S]*?)<\/underline>/gi, '<u>$1</u>')

  result = result.replace(/<link[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/link>/gi, '[$2]($1)')

  return result
}

function containsRawMarkdown(text: string): boolean {
  if (!text) return false

  if (/^#+\s/m.test(text)) return true

  if (/\*\*[^*]+\*\*/.test(text)) return true
  if (/\*[^*]+\*/.test(text)) return true
  if (/__[^_]+__/.test(text)) return true
  if (/_[^_]+_/.test(text)) return true

  if (/`[^`]+`/.test(text)) return true

  // 4. Bullet lists: line starting with "- " or "* " (excluding horizontal rules)
  if (/^\s*[-*]\s+\S+/m.test(text)) {
    if (!/^\s*(?:-{3,}|\*{3,})\s*$/m.test(text)) {
      return true
    }
  }

  // 5. Numbered lists: line starting with "1. ", "2. ", etc.
  if (/^\s*\d+\.\s+\S+/m.test(text)) return true

  // 6. Blockquotes: line starting with "> "
  if (/^\s*>\s+\S+/m.test(text)) return true

  // 7. Links: [text](url)
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) return true

  // 8. Custom HTML-like tags from Flutter mobile clobber (e.g. <bold>, <code>, <italic>, <underline>, <link>)
  if (/<(?:bold|code|italic|underline|link)>/i.test(text)) return true
  if (/<\/(?:bold|code|italic|underline|link)>/i.test(text)) return true

  // 9. Tables: line starting and containing pipe characters
  if (/^\s*\|.+?\|.+?\|/m.test(text)) return true

  return false
}

function markdownToHtml(text: string): string {
  if (!text) return text

  let html = text

  // 1. Normalize code tags
  html = html.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
  html = html.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

  // 2. Headings
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>')

  // 3. Bold
  html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([\s\S]*?)__/g, '<strong>$1</strong>')

  // 4. Italic
  html = html.replace(/\*([\s\S]*?)\*/g, '<em>$1</em>')
  html = html.replace(/_([\s\S]*?)_/g, '<em>$1</em>')

  // 5. Inline Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 6. Blockquotes
  html = html.replace(/^\s*>\s+(.*?)$/gm, '<blockquote>$1</blockquote>')

  // 7. Bullet lists
  let inList = false
  const lines = html.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*[-*]\s+(.*)$/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, '')
      lines[i] = (inList ? '' : '<ul>') + `<li>${content}</li>`
      inList = true
    } else {
      if (inList) {
        lines[i] = '</ul>' + line
        inList = false
      }
    }
  }
  if (inList) {
    lines[lines.length - 1] += '</ul>'
  }
  html = lines.join('\n')

  let inOList = false
  const olLines = html.split('\n')
  for (let i = 0; i < olLines.length; i++) {
    const line = olLines[i]
    if (/^\s*\d+\.\s+(.*)$/.test(line)) {
      const content = line.replace(/^\s*\d+\.\s+/, '')
      olLines[i] = (inOList ? '' : '<ol>') + `<li>${content}</li>`
      inOList = true
    } else {
      if (inOList) {
        olLines[i] = '</ol>' + line
        inOList = false
      }
    }
  }
  if (inOList) {
    olLines[olLines.length - 1] += '</ol>'
  }
  html = olLines.join('\n')

  const tableLines = html.split('\n')
  let inTable = false
  let tableHtml = ''
  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i].trim()
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      if (line.includes('---')) {
        tableLines[i] = ''
        continue
      }
      if (!inTable) {
        tableHtml = '<table><thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
        inTable = true
      } else {
        tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>'
      }
      tableLines[i] = ''
    } else {
      if (inTable) {
        tableHtml += '</tbody></table>'
        tableLines[i] = tableHtml + '\n' + tableLines[i]
        inTable = false
      }
    }
  }
  if (inTable) {
    tableHtml += '</tbody></table>'
    tableLines[tableLines.length - 1] += '\n' + tableHtml
  }
  html = tableLines.filter(line => line !== '').join('\n')

  return html
}

function isXmlTextFormatted(xmlText: Y.XmlText): boolean {
  try {
    const delta = xmlText.toDelta()

    return delta.some((op: { attributes?: Record<string, unknown> }) => op.attributes && Object.keys(op.attributes).length > 0)
  } catch {
    return false
  }
}

function isFlatPlainTextFragment(fragment: Y.XmlFragment): boolean {
  if (fragment.length === 0) return true

  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i)

    if (!(child instanceof Y.XmlElement) || child.nodeName !== 'paragraph') {
      return false
    }

    for (let j = 0; j < child.length; j++) {
      const grandChild = child.get(j)
      if (!(grandChild instanceof Y.XmlText)) {
        return false
      }
      if (isXmlTextFormatted(grandChild)) {
        return false
      }
    }
  }

  return true
}

class EditorErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean, errorKey: number }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, errorKey: 0 }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[NoteEditor] Editor crashed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-sm text-neutral-400">The editor encountered an error.</p>
          <button
            onClick={() => this.setState({ hasError: false, errorKey: Date.now() })}
            className="px-4 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md transition-colors"
          >
            Reload Editor
          </button>
        </div>
      )
    }
    return <div key={this.state.errorKey} className="contents">{this.props.children}</div>
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = ''
  const len = arr.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return window.btoa(binary)
}

function showToast(msg: string) {
  if (typeof document === 'undefined') return
  const el = document.createElement('div')
  el.textContent = msg
  el.setAttribute('role', 'alert')
  el.setAttribute('aria-live', 'polite')
  el.className = 'fixed bottom-4 right-4 bg-neutral-800 text-neutral-200 border border-neutral-700 px-4 py-2 rounded-md shadow-lg z-[9999] transition-opacity duration-300'
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, 3000)
}

export function NoteEditor({
  id,
  content,
  onChange
}: {
  id: string,
  content?: NoteContent,
  onChange?: (snapshot: { content: NoteContent, body: string | null, excerpt: string | null }) => void
}) {
  const setFocusedNoteId = useNotesStore(s => s.setFocusedNoteId); const markNoteActivity = useNotesStore(s => s.markNoteActivity); const clearActiveNoteActivity = useNotesStore(s => s.clearActiveNoteActivity); const updateNoteLocal = useNotesStore(s => s.updateNoteLocal)
  const editorRef = useRef<Editor | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const hasPendingLocalChangeRef = useRef(false)
  const pendingUpdatesRef = useRef<Uint8Array[]>([])
  const onChangeRef = useRef(onChange)
  const [isLoading, setIsLoading] = useState(true)
  const ydoc = useMemo(() => acquireYDoc(id), [id])
  const repairedNotesRef = useRef<Set<string>>(new Set())
  const initGenerationRef = useRef(0)
  const updatesSinceSnapshotRef = useRef(0)
  const lastSnapshotTimeRef = useRef(Date.now())
  const persistRetryCountRef = useRef(0)

  useEffect(() => {
    const activeId = id
    return () => {
      releaseYDoc(activeId)
    }
  }, [id])

  const contentRef = useRef(content)
  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const persistNow = useCallback(async (broadcast: boolean, forceSnapshot = false) => {
    const userId = useUserStore.getState().user?.id
    if (!userId) return

    if (isSavingRef.current) {
      pendingSaveRef.current = true
      return
    }

    if (pendingUpdatesRef.current.length === 0 && !hasPendingLocalChangeRef.current) return

    isSavingRef.current = true
    pendingSaveRef.current = false
    const pendingBatch = pendingUpdatesRef.current.splice(0)
    const now = new Date().toISOString()
    const currentEditor = editorRef.current
    const body = currentEditor && !currentEditor.isDestroyed
      ? currentEditor.state.doc.textContent
      : getPlainTextFromYDoc(id)
    const excerpt = body.length > 100 ? `${body.slice(0, 100)}...` : body

    const contentVal = currentEditor && !currentEditor.isDestroyed ? currentEditor.getJSON() : null

    markLocallyModified(id)
    updateNoteLocal(id, { body, excerpt, content: contentVal || undefined, updated_at: now })
    onChangeRef.current?.({ content: contentVal, body, excerpt })

    const nowTime = Date.now()
    updatesSinceSnapshotRef.current += pendingBatch.length
    const shouldSnapshot =
      forceSnapshot ||
      updatesSinceSnapshotRef.current >= 50 ||
      (nowTime - lastSnapshotTimeRef.current) >= 5 * 60 * 1000 ||
      lastSnapshotTimeRef.current === 0

    const snapshot = shouldSnapshot ? Y.encodeStateAsUpdate(ydoc) : null

    if (shouldSnapshot) {
      updatesSinceSnapshotRef.current = 0
      lastSnapshotTimeRef.current = nowTime
    }

    try {
      const updateData = pendingBatch.length === 1
        ? pendingBatch[0]
        : Y.mergeUpdates(pendingBatch)
      await saveYDocToSupabase(id, userId, {
        updateData,
        snapshot,
        content: contentVal || undefined,
      })
      hasPendingLocalChangeRef.current = false
      persistRetryCountRef.current = 0
    } catch (err) {

      if (isNonRetryableError(err)) {
        if (__DEV__) console.error('[NoteEditor] Non-retryable sync error, not scheduling retry:', err)
        hasPendingLocalChangeRef.current = false
        pendingUpdatesRef.current = []
        persistRetryCountRef.current = 0
        isSavingRef.current = false
        return
      }

      pendingUpdatesRef.current = pendingBatch.concat(pendingUpdatesRef.current)
      hasPendingLocalChangeRef.current = true
      persistRetryCountRef.current++
      if (__DEV__) console.error(`[NoteEditor] Failed to persist note state (attempt ${persistRetryCountRef.current}/${MAX_PERSIST_RETRIES}):`, err)

      if (persistRetryCountRef.current >= MAX_PERSIST_RETRIES) {
        showToast('Sync failed. Your changes are saved locally and will retry later.')
        persistRetryCountRef.current = 0
        isSavingRef.current = false
        return
      }

      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null
        void persistNow(broadcast, forceSnapshot)
      }, RETRY_DELAY_MS)
      return
    } finally {
      isSavingRef.current = false
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        setTimeout(() => {
          void persistNowRef.current(true)
        }, 10)
      }
    }

    if (!broadcast) return

    const note = useNotesStore.getState().notes.find(n => n.id === id)
    const timestamp = hlc.increment()
    const mergedVersions: Record<string, string> = {
      ...(note?.field_versions || {}),
      body: timestamp,
      excerpt: timestamp,
      updated_at: timestamp,
    }

    void sendNoteBroadcast({
      id,
      content: note?.content || null,
      body,
      excerpt,
      hlc_timestamp: timestamp,
      updated_at: now,
      field_versions: mergedVersions,
    })
  }, [id, updateNoteLocal, ydoc])

  useEffect(() => {
    const generation = ++initGenerationRef.current
    setIsLoading(true)

    const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage: string = 'Timeout'): Promise<T> => {
      let timer: NodeJS.Timeout
      return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(errorMessage)), ms)
        })
      ])
    }

    const init = async () => {
      try {

        try {
          const stashRaw = window.localStorage.getItem(`synq-pending-unload:${id}`)
          if (stashRaw) {
            const parsed = JSON.parse(stashRaw)
            const validation = stashSchema.safeParse(parsed)
            if (validation.success) {
              const stashed = validation.data
              if (stashed && stashed.updateData) {
                const updateData = base64ToUint8Array(stashed.updateData)
                applyRemoteUpdate(id, updateData)

                updateNoteLocal(id, {
                  body: stashed.body || null,
                  excerpt: stashed.excerpt || null,
                  content: stashed.content || undefined,
                  updated_at: stashed.updatedAt || new Date().toISOString()
                })

                const userId = useUserStore.getState().user?.id
                if (userId) {
                  const snapshot = stashed.snapshot ? base64ToUint8Array(stashed.snapshot) : undefined
                  await enqueueQueuedNoteCrdtUpdate({
                    noteId: id,
                    userId,
                    clientId: hlc.getNodeId(),
                    opId: stashed.opId || `recovered-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    updateData,
                    body: stashed.body || null,
                    excerpt: stashed.excerpt || null,
                    snapshot,
                    updatedAt: stashed.updatedAt || new Date().toISOString(),
                    content: stashed.content,
                  })
                  triggerFlush()
                }
              }
              window.localStorage.removeItem(`synq-pending-unload:${id}`)
              console.log(`[NoteEditor] Successfully recovered stashed edits for ${id.slice(0, 8)}…`)
            } else {
              console.warn('[NoteEditor] Failed to validate stashed edits:', validation.error)
              window.localStorage.removeItem(`synq-pending-unload:${id}`)
            }
          }
        } catch (stashErr) {
          console.error('[NoteEditor] Failed to recover stashed edits:', stashErr)
        }

        if (generation !== initGenerationRef.current) return

        try {
          await withTimeout(waitForPersistence(id), 3000, 'waitForPersistence timeout')
        } catch (err) {
          console.warn('[NoteEditor] Persistence wait failed or timed out:', err)
        }

        if (generation !== initGenerationRef.current) return

        let remoteSeq = 0
        try {
          const remoteDoc = await withTimeout(loadYDocFromSupabase(id), 15000, 'loadYDocFromSupabase timeout')
          if (generation !== initGenerationRef.current) return
          if (remoteDoc) {
            if (remoteDoc.state) {
              applyRemoteUpdate(id, remoteDoc.state)
            }
            remoteSeq = remoteDoc.lastSeq
          }
        } catch (err) {
          const isTimeout = err instanceof Error && err.message.includes('timeout')
          console.warn(
            `[NoteEditor] Failed to load remote Yjs state${isTimeout ? ' (timed out — database could be waking up)' : ''}:`,
            err
          )
        }

        if (generation !== initGenerationRef.current) return

        setIsLoading(false)

        try {
          let cursor = getLocalLastSeq(id)

          if (cursor === 0 && remoteSeq > 0) {
            cursor = remoteSeq
            setLocalLastSeq(id, cursor)
            console.log(`[NoteEditor] Race-free cold boot cursor jump to snapshot seq: ${cursor}`)
          } else if (remoteSeq > cursor) {

            cursor = remoteSeq
            setLocalLastSeq(id, cursor)
          }

          const pageSize = 500
          for (let page = 0; page < 20; page++) {
            if (generation !== initGenerationRef.current) return
            const ops = await withTimeout(getNoteCrdtUpdates(id, cursor, pageSize), 15000, 'getNoteCrdtUpdates timeout')
            if (generation !== initGenerationRef.current) return
            if (!ops.length) break
            for (const row of ops) {
              const update = toUint8Update(row.update_data)
              if (update) {
                applyRemoteUpdate(id, update)
              }
              cursor = Math.max(cursor, Number(row.seq || 0))
            }
            if (cursor > 0) {
              setLocalLastSeq(id, cursor)
            }
            if (ops.length < pageSize) break
          }
        } catch (_err) {
          const isTimeout = _err instanceof Error && _err.message.includes('timeout')
          console.warn(
            `[NoteEditor] Failed to replay oplog catch-up${isTimeout ? ' (timed out — database could be waking up)' : ''}:`,
            _err
          )
        }
      } catch (_err) {
        console.error('[NoteEditor] Fatal error during initialization:', _err)
      } finally {
        if (generation === initGenerationRef.current) {
          setIsLoading(false)
        }
      }
    }

    init()
  }, [id, ydoc, updateNoteLocal])

  const persistNowRef = useRef(persistNow)
  useEffect(() => {
    persistNowRef.current = persistNow
  }, [persistNow])

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persistNowRef.current(true)
    }, SAVE_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    const handleUpdate = (update: Uint8Array, origin: string | null) => {

      if (origin !== 'remote' && origin !== 'mobile-sync') {
        pendingUpdatesRef.current.push(new Uint8Array(update))
        hasPendingLocalChangeRef.current = true
        debouncedSave()
      }
    }

    ydoc.on('update', handleUpdate)
    return () => {
      ydoc.off('update', handleUpdate)
    }
  }, [ydoc, debouncedSave])

  useEffect(() => {
    const persistPending = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }

      if (hasPendingLocalChangeRef.current) {
        try {
          const pendingBatch = pendingUpdatesRef.current
          if (pendingBatch.length > 0) {
            const mergedUpdate = pendingBatch.length === 1
              ? pendingBatch[0]
              : Y.mergeUpdates(pendingBatch)

            const updateDataStr = uint8ArrayToBase64(mergedUpdate)
            const snapshot = Y.encodeStateAsUpdate(ydoc)
            const snapshotStr = uint8ArrayToBase64(snapshot)
            const nowStr = new Date().toISOString()

            const body = editorRef.current && !editorRef.current.isDestroyed
              ? editorRef.current.state.doc.textContent
              : getPlainTextFromYDoc(id)
            const excerpt = body.length > 100 ? `${body.slice(0, 100)}...` : body

            const contentVal = editorRef.current && !editorRef.current.isDestroyed
              ? editorRef.current.getJSON()
              : null

            const stash = {
              noteId: id,
              opId: `unload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              updateData: updateDataStr,
              snapshot: snapshotStr,
              body,
              excerpt,
              content: contentVal,
              updatedAt: nowStr,
            }

            const serialized = JSON.stringify(stash)
            if (serialized.length > 4 * 1024 * 1024) { 
              console.warn('[NoteEditor] Unload stash exceeds 4MB. Saving Yjs binary only.')
              stash.content = null
            }

            window.localStorage.setItem(`synq-pending-unload:${id}`, JSON.stringify(stash))
            console.log(`[NoteEditor] Synchronously stashed pending edits to localStorage for note ${id.slice(0, 8)}…`)
          }
        } catch (err) {
          console.error('[NoteEditor] Failed to stash pending edits synchronously on unload:', err)
        }

        void persistNow(false, true)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistPending()
      }
    }

    window.addEventListener('pagehide', persistPending)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', persistPending)

    return () => {
      window.removeEventListener('pagehide', persistPending)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', persistPending)
    }
  }, [id, ydoc, persistNow])

  const extensions = useMemo(() => [
    StarterKit.configure({

      undoRedo: false,
      link: false,
      underline: false,
      codeBlock: false, 
      gapcursor: false,
      dropcursor: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'typescript',
      HTMLAttributes: {
        class: 'hljs',
      },
    }),
    Collaboration.configure({
      document: ydoc,
      field: 'content',
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-[#2eaadc] underline hover:text-[#2eaadc]/80 transition-colors cursor-pointer',
      },
    }),
    Underline,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Image.configure({
      allowBase64: true,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    TextAlign.configure({
      types: ['heading', 'paragraph', 'tableCell', 'tableHeader'],
    }),
    Markdown.configure({
      html: true,
      tightLists: true,
      tightListClass: 'tight',
      bulletListMarker: '-',
      linkify: true,
      breaks: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return `Heading ${node.attrs.level}`
        }
        if (node.type.name === 'callout') {
          return 'Type something...'
        }
        if (node.type.name === 'paragraph') {
          return "Type '/' for commands"
        }
        if (node.type.name === 'codeBlock') {
          return '// Write code...'
        }
        return ""
      },
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      includeChildren: true,
    }),
    CalloutNode,
    SlashCommand.configure({
      suggestion: suggestionConfig,
    }),
    GlobalDragHandle.configure({
      dragHandleWidth: 20,
      scrollTreshold: 100,
    }),
    GapCursor,
    Dropcursor.configure({
      color: '#2eaadc',
      width: 2,
    }),
    Focus.configure({
      className: 'is-block-focused',
      mode: 'deepest',
    }),
    TrailingNode,
  ], [ydoc])

  const editorProps = useMemo(() => ({
    attributes: {
      class: `${styles.editorContent} max-w-none focus:outline-none min-h-[calc(100vh-300px)] pt-2 pb-32`,
    },
    // Prevent huge image uploads (Limit base64 footprint in DB)
    handlePaste(view: unknown, event: ClipboardEvent) {
      const items = event.clipboardData?.items
      if (items) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file && file.size > 500 * 1024) {
              showToast("Image is too large. Max size is 500KB.")
              event.preventDefault()
              return true
            }
          }
        }
      }
      return false
    },
    handleDrop(view: unknown, event: DragEvent, _slice: unknown, moved: boolean) {
      if (moved) return false
      const files = event.dataTransfer?.files
      if (files) {
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/') && file.size > 500 * 1024) {
            showToast("Image is too large. Max size is 500KB.")
            event.preventDefault()
            return true
          }
        }
      }
      return false
    },
    transformPastedHTML(html: string) {
      if (!html) return html

      // 1. Create a parser to manipulate nodes safely in memory
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      // 1.5. If the HTML text content contains raw markdown, translate it to rich elements
      const plainText = doc.body.textContent || ''
      if (containsRawMarkdown(plainText)) {
        const parsedHtml = markdownToHtml(plainText)
        doc.body.innerHTML = parsedHtml
      }

      // 2. Convert elements with inline background-color style to <mark> elements for Tiptap Highlight
      doc.querySelectorAll('[style*="background-color"], [style*="background:"]').forEach(el => {
        const element = el as HTMLElement
        const bg = element.style.backgroundColor || element.style.background
        if (bg && bg !== 'transparent') {

          const mark = doc.createElement('mark')
          mark.setAttribute('data-color', bg)
          mark.style.backgroundColor = bg

          while (element.firstChild) {
            mark.appendChild(element.firstChild)
          }

          element.style.removeProperty('background-color')
          element.style.removeProperty('background')

          element.appendChild(mark)
        }
      })

      doc.querySelectorAll('.notion-header-block, h1').forEach(el => {
        if (el.tagName !== 'H1') {
          const h1 = doc.createElement('h1')
          h1.innerHTML = el.innerHTML
          el.replaceWith(h1)
        }
      })
      doc.querySelectorAll('.notion-sub_header-block, h2').forEach(el => {
        if (el.tagName !== 'H2') {
          const h2 = doc.createElement('h2')
          h2.innerHTML = el.innerHTML
          el.replaceWith(h2)
        }
      })
      doc.querySelectorAll('.notion-sub_sub_header-block, h3').forEach(el => {
        if (el.tagName !== 'H3') {
          const h3 = doc.createElement('h3')
          h3.innerHTML = el.innerHTML
          el.replaceWith(h3)
        }
      })

      doc.querySelectorAll('[class*="bulleted_list-block"], [class*="list-bullet"]').forEach(el => {
        const li = doc.createElement('li')
        li.innerHTML = el.innerHTML
        const ul = doc.createElement('ul')
        ul.appendChild(li)
        el.replaceWith(ul)
      })

      doc.querySelectorAll('[class*="numbered_list-block"], [class*="list-numbered"]').forEach(el => {
        const li = doc.createElement('li')
        li.innerHTML = el.innerHTML
        const ol = doc.createElement('ol')
        ol.appendChild(li)
        el.replaceWith(ol)
      })

      doc.querySelectorAll('[class*="to_do-block"]').forEach(el => {
        const li = doc.createElement('li')
        li.setAttribute('data-type', 'taskItem')

        const checkbox = doc.createElement('input')
        checkbox.setAttribute('type', 'checkbox')
        if (el.getAttribute('data-checked') === 'true') {
          checkbox.setAttribute('checked', 'checked')
          li.setAttribute('data-checked', 'true')
        }

        const contentDiv = doc.createElement('div')
        contentDiv.innerHTML = el.innerHTML

        li.appendChild(checkbox)
        li.appendChild(contentDiv)

        const ul = doc.createElement('ul')
        ul.setAttribute('data-type', 'taskList')
        ul.appendChild(li)
        el.replaceWith(ul)
      })

      doc.querySelectorAll('.notion-quote-block').forEach(el => {
        const blockquote = doc.createElement('blockquote')
        blockquote.innerHTML = el.innerHTML
        el.replaceWith(blockquote)
      })

      return DOMPurify.sanitize(doc.body.innerHTML, {
        ALLOWED_TAGS: [
          'p', 'span', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'a',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'mark',
          'label', 'input', 'hr', 'sub', 'sup'
        ],
        ALLOWED_ATTR: [
          'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
          'data-type', 'data-checked', 'checked', 'disabled', 'type', 'data-color'
        ],
      })
    },
  }), [])

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    onUpdate: () => {

      markNoteActivity(id)
      setActiveEdit(id, true)

    },
    onFocus: () => {
      setFocusedNoteId(id)
      setActiveEdit(id, true)
    },
    onBlur: () => {
      setFocusedNoteId(null)
      clearActiveNoteActivity(id)
      setActiveEdit(id, false)

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }

      void persistNow(true, true)
    },
    editorProps,
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!isLoading && editor && !editor.isDestroyed) {
      let fragmentLength = 0
      let isPlain = true
      let isYjsCorrupted = false

      const plainText = getPlainTextFromYDoc(id)
      const contentValue = getEditorContentValue(contentRef.current ?? null)

      ydoc.transact(() => {
        const fragment = ydoc.getXmlFragment('content')
        fragmentLength = fragment.length
        isPlain = isFlatPlainTextFragment(fragment)

        if (fragmentLength > 0 && contentValue && typeof contentValue === 'object') {
          const jsonStr = JSON.stringify(contentValue)

          if (plainText.length < 50 && jsonStr.length > 500) {
            isYjsCorrupted = true
          }
        }
      })

      const hasFlutter = containsFlutterTags(plainText)
      const hasRawMarkdown = containsRawMarkdown(plainText)
      const repRef = repairedNotesRef.current.has(id)

      if (__DEV__) {
        console.group('[NoteEditor Auto-Repair Check]')
        console.log('Note ID:', id)
        console.log('Fragment length:', fragmentLength)
        console.log('Is flat plain-text:', isPlain)
        console.log('Contains Flutter tags:', hasFlutter)
        console.log('Contains raw Markdown:', hasRawMarkdown)
        console.log('Already repaired in this session:', repRef)
        console.groupEnd()
      }

      const shouldRepair = fragmentLength > 0 && (
        hasFlutter ||
        (isPlain && hasRawMarkdown)
      ) && !repRef

      if (shouldRepair && plainText) {
        repairedNotesRef.current.add(id)

        try {
          if (__DEV__) console.group('[NoteEditor] Self-healing repair triggered for note:', id)
          const cleanedMarkdown = convertCustomTagsToMarkdown(plainText)
          if (__DEV__) console.log('[NoteEditor] Translated mobile tags to standard Markdown:', cleanedMarkdown)
          const parsedNode = (editor.storage as unknown as { markdown: { parser: { parse: (text: string) => Parameters<Editor['commands']['setContent']>[0] } } }).markdown.parser.parse(cleanedMarkdown)
          editor.commands.setContent(parsedNode)
        } catch (_err) {
          console.error('[NoteEditor] Failed to parse raw Yjs markdown plain text during repair:', _err)
        }
      } else if (fragmentLength === 0 || isYjsCorrupted) {

        if (isYjsCorrupted) {
          console.warn('[NoteEditor] Force-seeding from server JSON because Yjs state appears corrupted.')

          ydoc.transact(() => {
            const fragment = ydoc.getXmlFragment('content')
            fragment.delete(0, fragment.length)
          })
        }
        if (contentValue) {
          if (typeof contentValue === 'string') {

            try {
              if (__DEV__) console.group('[NoteEditor] Initial markdown content seeding for note:', id)
              const cleanedMarkdown = convertCustomTagsToMarkdown(contentValue)
              if (__DEV__) console.log('[NoteEditor] Translated raw markdown content:', cleanedMarkdown)

              const parsedNode = (editor.storage as unknown as { markdown: { parser: { parse: (text: string) => Parameters<Editor['commands']['setContent']>[0] } } }).markdown.parser.parse(cleanedMarkdown)
              editor.commands.setContent(parsedNode)
              if (__DEV__) console.log('[NoteEditor] Markdown content successfully seeded!')
              if (__DEV__) console.groupEnd()
            } catch (err) {
              console.error('[NoteEditor] Failed to parse raw markdown content, skipping seed to preserve integrity:', err)
              if (__DEV__) console.groupEnd()
            }
          } else {
            editor.commands.setContent(contentValue)
          }
        }
      }
    }
  }, [isLoading, editor, ydoc, id])

  useEffect(() => {
    if (editor && !editor.isDestroyed && !isLoading) {
      let modified = false
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && node.attrs.src?.startsWith('data:image/')) {
          const size = Math.floor(node.attrs.src.length * 0.75)
          if (size > 500 * 1024) {

            setTimeout(() => {
              if (!editor.isDestroyed) {
                editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize })
              }
            }, 0)
            modified = true
          }
        }
      })
      if (modified) {
        showToast("Removed oversized base64 images from document to protect performance.")
      }
    }
  }, [editor, isLoading])

  useEffect(() => {
    return () => {

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      if (
        editorRef.current &&
        !editorRef.current.isDestroyed &&
        hasPendingLocalChangeRef.current &&
        !isSavingRef.current
      ) {
        let contentVal: ReturnType<Editor['getJSON']> | null = null
        try {
          contentVal = editorRef.current.getJSON()
        } catch (err) {
          console.error('[NoteEditor] Failed to capture editor state on unmount:', err)
        }

        const body = editorRef.current && !editorRef.current.isDestroyed
          ? editorRef.current.state.doc.textContent
          : getPlainTextFromYDoc(id)
        const excerpt = body.length > 100 ? `${body.slice(0, 100)}...` : body

        const userId = useUserStore.getState().user?.id
        if (userId) {
          const pendingBatch = pendingUpdatesRef.current
          pendingUpdatesRef.current = []
          hasPendingLocalChangeRef.current = false

          const updateData = pendingBatch.length === 1
            ? pendingBatch[0]
            : Y.mergeUpdates(pendingBatch)

          const snapshot = Y.encodeStateAsUpdate(ydoc)
          void saveYDocToSupabase(id, userId, {
            updateData,
            snapshot,
            content: contentVal,
          })

          updateNoteLocal(id, { body, excerpt, content: contentVal, updated_at: new Date().toISOString() })
        }
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      clearActiveNoteActivity(id)
      setFocusedNoteId(null)
      setActiveEdit(id, false)
    }

  }, [id, clearActiveNoteActivity, setFocusedNoteId, updateNoteLocal, ydoc])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto w-full pt-12 gap-8">
        <Skeleton className="h-12 w-3/4 bg-white/[0.03]" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full bg-white/[0.03]" />
          <Skeleton className="h-4 w-full bg-white/[0.03]" />
          <Skeleton className="h-4 w-2/3 bg-white/[0.03]" />
        </div>
        <div className="flex items-center justify-center pt-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-transparent max-w-4xl mx-auto w-full group">
      <div className="flex-1 relative min-h-[calc(100vh-300px)]">
        <NoteBubbleMenu editor={editor} />
        <TableBubbleMenu editor={editor} />
        <EditorErrorBoundary>
          <EditorContent editor={editor} />
        </EditorErrorBoundary>
      </div>
    </div>
  )
}
