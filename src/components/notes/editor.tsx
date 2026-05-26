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
import * as Y from 'yjs'
import { Loader2 } from "lucide-react"
import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommand, suggestionConfig } from './slash-command'
import { CalloutNode } from './callout-node'
import { NoteBubbleMenu } from './bubble-menu'
import { TableBubbleMenu } from './table-bubble-menu'
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { Editor } from '@tiptap/react'
import { useNotesStore } from '@/lib/store/use-notes-store'
import {
  getOrCreateYDoc,
  setActiveEdit,
  getPlainTextFromYDoc,
  getExcerptFromYDoc,
  markLocallyModified,
  waitForPersistence,
  applyRemoteUpdate,
} from '@/lib/crdt/crdt-doc'
import { saveYDocToSupabase, loadYDocFromSupabase } from '@/lib/crdt/sync-manager'
import { getLocalLastSeq, getNoteCrdtUpdates, setLocalLastSeq, toUint8Update } from '@/lib/crdt/oplog'
import { useUserStore } from '@/lib/store/use-user-store'
import type { NoteContent } from '@/types'
import { getEditorContentValue } from '@/lib/notes/note-content'
import { sendNoteBroadcast } from '@/lib/realtime/note-sync'
import { hlc } from '@/lib/hlc'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import DOMPurify from 'dompurify'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'

const lowlight = createLowlight(common)

const SAVE_DEBOUNCE_MS = 800


function containsRawMarkdown(text: string): boolean {
  if (!text) return false
  
  // 1. Headers: line starting with "# " through "###### "
  if (/^#+\s+\S+/m.test(text)) return true
  
  // 2. Bold or Italic: **bold**, *italic*, __bold__, _italic_
  if (/\*\*[^*`]+\*\*/.test(text)) return true
  if (/\*[^*`]+\*/.test(text)) return true
  if (/__[^_`]+__/.test(text)) return true
  if (/_[^_`]+_/.test(text)) return true
  
  // 3. Inline code: `code`
  if (/`[^`\n]+`/.test(text)) return true
  
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
  if (/\[[^\]\n]+\]\([^)\n]+\)/.test(text)) return true

  // 8. Custom HTML-like tags from Flutter mobile clobber (e.g. <bold>, <code>, <italic>, <underline>, <link>)
  if (/<(?:bold|code|italic|underline|link)>/i.test(text)) return true
  if (/<\/(?:bold|code|italic|underline|link)>/i.test(text)) return true
  
  return false
}

function convertCustomTagsToMarkdown(text: string): string {
  if (!text) return text
  
  let result = text
  
  // 1. Convert <bold>text</bold> to **text**
  result = result.replace(/<bold>([\s\S]*?)<\/bold>/gi, '**$1**')
  
  // 2. Convert <italic>text</italic> to *text*
  result = result.replace(/<italic>([\s\S]*?)<\/italic>/gi, '*$1*')
  
  // 3. Convert <code>text</code> to `text`
  result = result.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
  
  // 4. Convert <underline>text</underline> to <u>text</u>
  result = result.replace(/<underline>([\s\S]*?)<\/underline>/gi, '<u>$1</u>')
  
  // 5. Convert <link ... href="URL" ...>TEXT</link> to [TEXT](URL)
  result = result.replace(/<link[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/link>/gi, '[$2]($1)')
  
  return result
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
  const { setFocusedNoteId, markNoteActivity, clearActiveNoteActivity, updateNoteLocal } = useNotesStore()
  const editorRef = useRef<Editor | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)
  const hasPendingLocalChangeRef = useRef(false)
  const pendingUpdatesRef = useRef<Uint8Array[]>([])
  const saveSinceSnapshotRef = useRef(0)
  const [isLoading, setIsLoading] = useState(true)
  const ydoc = useMemo(() => getOrCreateYDoc(id), [id])
  const repairedNotesRef = useRef<Set<string>>(new Set())

  // Store initial content in a ref to avoid re-triggering initialization if it changes
  const contentRef = useRef(content)
  useEffect(() => {
    contentRef.current = content
  }, [content])

  const persistNow = useCallback(async (broadcast: boolean) => {
    const userId = useUserStore.getState().user?.id
    if (!userId || isSavingRef.current) return
    if (pendingUpdatesRef.current.length === 0 && !hasPendingLocalChangeRef.current) return

    isSavingRef.current = true
    const pendingBatch = pendingUpdatesRef.current
    pendingUpdatesRef.current = []
    const now = new Date().toISOString()
    const body = getPlainTextFromYDoc(id)
    const excerpt = getExcerptFromYDoc(id)

    // Retrieve latest Tiptap JSON content from the editor ref
    const currentEditor = editorRef.current
    const contentVal = currentEditor && !currentEditor.isDestroyed ? currentEditor.getJSON() : null

    markLocallyModified(id)
    updateNoteLocal(id, { body, excerpt, content: contentVal || undefined, updated_at: now })
    onChange?.({ content: contentVal, body, excerpt })

    try {
      const updateData = pendingBatch.length === 1
        ? pendingBatch[0]
        : Y.mergeUpdates(pendingBatch)
      const snapshot = Y.encodeStateAsUpdate(ydoc)
      await saveYDocToSupabase(id, userId, {
        updateData,
        snapshot,
        content: contentVal || undefined,
      })
      saveSinceSnapshotRef.current += 1
      hasPendingLocalChangeRef.current = false
    } catch (err) {
      pendingUpdatesRef.current = pendingBatch.concat(pendingUpdatesRef.current)
      hasPendingLocalChangeRef.current = true
      console.error('[NoteEditor] Failed to persist note state:', err)
      return
    } finally {
      isSavingRef.current = false
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
  }, [id, onChange, updateNoteLocal, ydoc])

  // Initialize the Yjs doc from IndexedDB/Supabase
  useEffect(() => {
    let mounted = true
    // setIsLoading is initialized to true; re-entering means we need to reset it.
    // We do this via a microtask to avoid synchronous setState in the effect body.
    queueMicrotask(() => { if (mounted) setIsLoading(true) })

    // Helper to prevent promises from hanging indefinitely
    const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage: string = 'Timeout'): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
      ])
    }

    const init = async () => {
      try {
        // 1. Wait for IndexedDB persistence to finish loading
        try {
          await withTimeout(waitForPersistence(id), 3000, 'waitForPersistence timeout')
        } catch (err) {
          console.warn('[NoteEditor] Persistence wait failed or timed out:', err)
        }

        if (!mounted) return

        // 2. Always merge remote Yjs state to avoid stale local IndexedDB snapshots after refresh.
        // We use a robust 15-second timeout to accommodate cold starts on free-tier database instances.
        try {
          const remoteUpdate = await withTimeout(loadYDocFromSupabase(id), 15000, 'loadYDocFromSupabase timeout')
          if (remoteUpdate && mounted) {
            applyRemoteUpdate(id, remoteUpdate)
          }
        } catch (err) {
          const isTimeout = err instanceof Error && err.message.includes('timeout')
          console.warn(
            `[NoteEditor] Failed to load remote Yjs state${isTimeout ? ' (timed out — database could be waking up)' : ''}:`,
            err
          )
        }

        if (!mounted) return

        // 2.5 Replay missing incremental ops after local cursor.
        try {
          let cursor = getLocalLastSeq(id)
          const pageSize = 500
          for (let page = 0; page < 20; page++) {
            const ops = await withTimeout(getNoteCrdtUpdates(id, cursor, pageSize), 15000, 'getNoteCrdtUpdates timeout')
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
        } catch (err) {
          const isTimeout = err instanceof Error && err.message.includes('timeout')
          console.warn(
            `[NoteEditor] Failed to replay oplog catch-up${isTimeout ? ' (timed out — database could be waking up)' : ''}:`,
            err
          )
        }
      } catch (err) {
        console.error('[NoteEditor] Fatal error during initialization:', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [id, ydoc])

  // Debounced save to Supabase
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persistNow(true)
    }, SAVE_DEBOUNCE_MS)
  }, [persistNow])

  // Monitor Yjs document updates to trigger saves
  useEffect(() => {
    const handleUpdate = (update: Uint8Array, origin: string | null) => {
      // If the update came from a 'remote' transaction (via applyRemoteUpdate),
      // we skip scheduling a save to prevent a loop.
      if (origin !== 'remote') {
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
        void persistNow(false)
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
  }, [persistNow])

  const extensions = useMemo(() => [
    StarterKit.configure({
      // Disable the built-in undo/redo — Yjs Collaboration handles it
      undoRedo: false,
      link: false,
      underline: false,
      codeBlock: false, // Replaced by CodeBlockLowlight for syntax highlighting
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
      transformPastedText: false,
      transformCopiedText: true,
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return `Heading ${node.attrs.level}`
        }
        if (node.type.name === 'callout') {
          return 'Callout content...'
        }
        return "Type '/' for commands..."
      },
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
  ], [ydoc])

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    onUpdate: () => {
      // Mark as actively editing
      markNoteActivity(id)
      setActiveEdit(id, true)

      // We don't call debouncedSave here anymore. 
      // It's handled by the ydoc update listener below to avoid remote-echo loops.
    },
    onFocus: () => {
      setFocusedNoteId(id)
      setActiveEdit(id, true)
    },
    onBlur: () => {
      setFocusedNoteId(null)
      clearActiveNoteActivity(id)
      setActiveEdit(id, false)

      // Immediate save on blur — only if it was a local change
      // (Wait, blur is usually user-initiated, so it's safe to save)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }

      void persistNow(true)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[calc(100vh-300px)] pt-2 pb-32 text-[#E1E2E4] text-[15px] leading-[1.6] [&>*:first-child]:mt-0 font-sans selection:bg-[#4B7BFF]/30 selection:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-white prose-strong:text-white prose-blockquote:border-[#4B7BFF]/40 prose-blockquote:text-[#A1A3A7] prose-code:before:content-none prose-code:after:content-none [&_.is-empty::before]:text-neutral-600 [&_.is-empty::before]:content-[attr(data-placeholder)] [&_.is-empty::before]:float-left [&_.is-empty::before]:pointer-events-none [&_.is-empty::before]:h-0 [&_ul[data-type="taskList"]]:list-none [&_ul[data-type="taskList"]]:pl-0 [&_ul[data-type="taskList"]_li]:flex [&_ul[data-type="taskList"]_li]:items-start [&_ul[data-type="taskList"]_li]:gap-2.5 [&_ul[data-type="taskList"]_li_label]:flex [&_ul[data-type="taskList"]_li_label]:items-center [&_ul[data-type="taskList"]_li_label]:select-none [&_ul[data-type="taskList"]_li_div]:flex-1 [&_ul[data-type="taskList"]_input[type="checkbox"]]:w-4 [&_ul[data-type="taskList"]_input[type="checkbox"]]:h-4 [&_ul[data-type="taskList"]_input[type="checkbox"]]:rounded-md [&_ul[data-type="taskList"]_input[type="checkbox"]]:border-neutral-700 [&_ul[data-type="taskList"]_input[type="checkbox"]]:bg-neutral-900 [&_ul[data-type="taskList"]_input[type="checkbox"]]:accent-blue-500 [&_ul[data-type="taskList"]_li[data-checked="true"]_div]:line-through [&_ul[data-type="taskList"]_li[data-checked="true"]_div]:text-neutral-500',
      },
      transformPastedHTML(html) {
        if (!html) return html

        // 1. Create a parser to manipulate nodes safely in memory
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        // 2. Locate all span elements with inline background-color styling
        //    and wrap them in <mark> tags while preserving the span's other styles
        doc.querySelectorAll('span[style*="background-color"]').forEach(span => {
          const element = span as HTMLElement
          const bg = element.style.backgroundColor
          if (bg) {
            const mark = doc.createElement('mark')
            mark.setAttribute('data-color', bg)
            mark.style.backgroundColor = bg
            // Strip background-color from the original span to avoid duplication
            element.style.removeProperty('background-color')
            // Wrap the span (preserving its other styles like color, font-size) inside the mark
            mark.innerHTML = element.outerHTML
            element.replaceWith(mark)
          }
        })

        // 3. Sanitize and return the sanitized markup
        return DOMPurify.sanitize(doc.body.innerHTML, {
          FORCE_BODY: true,
          ALLOWED_TAGS: [
            'p', 'span', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'a',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
            'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'mark',
            'label', 'input', 'hr', 'sub', 'sup'
          ],
          ALLOWED_ATTR: [
            'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
            'data-type', 'data-checked', 'checked', 'disabled', 'type'
          ],
        })
      },
    },
  })

  // Synchronize editor ref for persistNow callback
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // Seed initial rich-text content if the Yjs document is empty and we have stored content,
  // or self-heal/repair the document if it contains raw markdown characters.
  useEffect(() => {
    if (!isLoading && editor && !editor.isDestroyed) {
      const fragment = ydoc.getXmlFragment('content')
      const plainText = getPlainTextFromYDoc(id)
      const shouldRepair = fragment.length > 0 && containsRawMarkdown(plainText) && !repairedNotesRef.current.has(id)

      if (shouldRepair && plainText) {
        repairedNotesRef.current.add(id)
        // If the note needs repair (contains raw markdown/tags), parse the Yjs plain text directly!
        try {
          console.group('[NoteEditor] Self-healing repair triggered for note:', id)
          const cleanedMarkdown = convertCustomTagsToMarkdown(plainText)
          console.log('[NoteEditor] Translated mobile tags to standard Markdown:', cleanedMarkdown)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsedNode = (editor.storage as any).markdown.parser.parse(cleanedMarkdown)
          editor.commands.setContent(parsedNode)
          console.log('[NoteEditor] Note self-healing successfully completed!')
          console.groupEnd()
        } catch (err) {
          console.error('[NoteEditor] Failed to parse raw Yjs markdown plain text during repair:', err)
          console.groupEnd()
        }
      } else if (fragment.length === 0) {
        // Normal seeding when Yjs doc is empty
        const contentValue = getEditorContentValue(contentRef.current ?? null)
        if (contentValue) {
          if (typeof contentValue === 'string') {
            // Raw markdown or custom tags string detected: Use the editor's markdown engine to parse it to rich-text JSON
            try {
              console.group('[NoteEditor] Initial markdown content seeding for note:', id)
              const cleanedMarkdown = convertCustomTagsToMarkdown(contentValue)
              console.log('[NoteEditor] Translated raw markdown content:', cleanedMarkdown)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parsedNode = (editor.storage as any).markdown.parser.parse(cleanedMarkdown)
              editor.commands.setContent(parsedNode)
              console.log('[NoteEditor] Markdown content successfully seeded!')
              console.groupEnd()
            } catch (err) {
              console.error('[NoteEditor] Failed to parse raw markdown content:', err)
              editor.commands.setContent(contentValue)
              console.groupEnd()
            }
          } else {
            editor.commands.setContent(contentValue)
          }
        }
      }
    }
  }, [isLoading, editor, ydoc, id])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Get the latest content from the editor synchronously BEFORE it is destroyed!
      if (editorRef.current && !editorRef.current.isDestroyed && hasPendingLocalChangeRef.current) {
        const contentVal = editorRef.current.getJSON()
        const body = getPlainTextFromYDoc(id)
        const excerpt = getExcerptFromYDoc(id)
        
        // Save to Supabase immediately using a synchronous capture of the editor state!
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
          
          // Also update the local store synchronously so the UI has the correct value when switching notes
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
      <div className="flex-1 relative">
        <NoteBubbleMenu editor={editor} />
        <TableBubbleMenu editor={editor} />
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
