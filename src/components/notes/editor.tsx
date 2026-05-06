"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { Markdown } from 'tiptap-markdown'
import * as Y from 'yjs'
import { 
  Bold, 
  Italic, 
  List as ListIcon, 
  ListOrdered, 
  Quote, 
  Heading1, 
  Heading2, 
  Code,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
import { useUserStore } from '@/lib/store/use-user-store'
import type { NoteContent } from '@/types'
import { getPlainTextFromStoredContent } from '@/lib/notes/note-content'
import { sendNoteBroadcast } from '@/lib/realtime/note-sync'
import { hlc } from '@/lib/hlc'

const SAVE_DEBOUNCE_MS = 800

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null

  const items = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: 'bold', label: 'Bold' },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: 'italic', label: 'Italic' },
    { icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: 'code', label: 'Code' },
    { type: 'separator' },
    { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: 'heading', activeOptions: { level: 1 }, label: 'H1' },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: 'heading', activeOptions: { level: 2 }, label: 'H2' },
    { type: 'separator' },
    { icon: ListIcon, action: () => editor.chain().focus().toggleBulletList().run(), active: 'bulletList', label: 'Bullet' },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: 'orderedList', label: 'Ordered' },
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: 'blockquote', label: 'Quote' },
  ]

  return (
    <div className="flex items-center gap-0.5 transition-all duration-200">
      {items.map((item, idx) => {
        if (item.type === 'separator') return <Separator key={idx} orientation="vertical" className="h-4 mx-2 bg-white/[0.03]" />
        
        const Icon = item.icon!
        return (
          <Button
            key={idx}
            variant="ghost"
            size="sm"
            onClick={item.action}
            title={item.label}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        )
      })}
    </div>
  )
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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)
  const hasPendingLocalChangeRef = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const ydoc = useMemo(() => getOrCreateYDoc(id), [id])

  // Store initial content in a ref to avoid re-triggering initialization if it changes
  const contentRef = useRef(content)
  useEffect(() => {
    contentRef.current = content
  }, [content])

  const persistNow = useCallback(async (broadcast: boolean) => {
    const userId = useUserStore.getState().user?.id
    if (!userId || isSavingRef.current) return

    isSavingRef.current = true
    hasPendingLocalChangeRef.current = false
    const now = new Date().toISOString()
    const body = getPlainTextFromYDoc(id)
    const excerpt = getExcerptFromYDoc(id)

    markLocallyModified(id)
    updateNoteLocal(id, { body, excerpt, updated_at: now })
    onChange?.({ content: null, body, excerpt })

    try {
      await saveYDocToSupabase(id, userId)
    } catch (err) {
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
  }, [id, onChange, updateNoteLocal])

  // Initialize the Yjs doc — if it's empty and we have TipTap content, seed it
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
        const doc = ydoc
        const fragment = doc.getXmlFragment('content')
        
        // 1. Wait for IndexedDB persistence to finish loading
        try {
          await withTimeout(waitForPersistence(id), 3000, 'waitForPersistence timeout')
        } catch (err) {
          console.warn('[NoteEditor] Persistence wait failed or timed out:', err)
        }
        
        if (!mounted) return

        // 2. Always merge remote Yjs state to avoid stale local IndexedDB snapshots after refresh.
        try {
          const remoteUpdate = await withTimeout(loadYDocFromSupabase(id), 5000, 'loadYDocFromSupabase timeout')
          if (remoteUpdate && mounted) {
            applyRemoteUpdate(id, remoteUpdate)
          }
        } catch (err) {
          console.warn('[NoteEditor] Failed to load remote Yjs state:', err)
        }

        if (!mounted) return

        // 3. If STILL empty and we have legacy content, seed it (migration)
        if (fragment.length === 0 && contentRef.current && mounted) {
          const plainText = typeof contentRef.current === 'string' ? contentRef.current : getPlainTextFromStoredContent(contentRef.current)
          if (plainText.trim()) {
            doc.transact(() => {
              const paragraphs = plainText.split('\n')
              for (const para of paragraphs) {
                const element = new Y.XmlElement('paragraph')
                if (para.trim()) {
                  element.insert(0, [new Y.XmlText(para)])
                }
                fragment.push([element])
              }
            })
          }
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
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the built-in undo/redo — Yjs Collaboration handles it
        undoRedo: false,
      }),
      Collaboration.configure({
        document: ydoc,
        field: 'content',
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: true,
        breaks: true,
      }),
    ],
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
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[calc(100vh-300px)] pt-0 pb-32 text-[#E1E2E4] text-[15px] leading-[1.6] [&>*:first-child]:mt-0 font-sans selection:bg-[#4B7BFF]/30 selection:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-white prose-p:text-[#A1A3A7] prose-strong:text-white prose-blockquote:border-[#4B7BFF]/40 prose-blockquote:text-[#A1A3A7] prose-code:text-[#4B7BFF] prose-code:bg-[#4B7BFF]/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none',
      },
    },
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      clearActiveNoteActivity(id)
      setFocusedNoteId(null)
      setActiveEdit(id, false)
    }
  }, [clearActiveNoteActivity, id, setFocusedNoteId])

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
      <div className="flex items-center justify-center sticky top-4 py-2 z-20 pointer-events-none">
        <div className="pointer-events-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <MenuBar editor={editor} />
        </div>
      </div>
      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
