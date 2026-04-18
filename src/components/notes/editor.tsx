"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { 
  Bold, 
  Italic, 
  List as ListIcon, 
  ListOrdered, 
  Quote, 
  Heading1, 
  Heading2, 
  Code
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useEffect, useRef, useState } from 'react'
import { Editor } from '@tiptap/react'
import { useNotesStore } from '@/lib/store/use-notes-store'
import { useUserStore } from '@/lib/store/use-user-store'
import { supabase } from '@/lib/supabase.client'
import { hlc } from '@/lib/hlc'

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
  content?: string | null, 
  onChange?: (content: string) => void 
}) {
  const { setFocusedNoteId } = useNotesStore()
  const { user } = useUserStore()
  const [isIdle, setIsIdle] = useState(true)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const broadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: true,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: true,
        breaks: true,
      }),
    ],
    content: content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown()
      const body = editor.getText().split('\n')[0] || '' // Simple excerpt
      const title = editor.getText().split('\n')[0] || 'Untitled'

      // Mark as NOT idle immediately on user input
      setIsIdle(false)
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = setTimeout(() => setIsIdle(true), 3000)
      
      // 1. INSTANT BROADCAST (200ms) - Sub-perceptual feedback for peers
      if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current)
      broadcastTimeoutRef.current = setTimeout(() => {
        if (!user?.id) return
        const channel = supabase.channel(`synq:notes:${user.id}`)
        channel.send({
          type: 'broadcast',
          event: 'note-update',
          payload: { 
            id, 
            content: markdown, 
            body,
            title,
            hlc_timestamp: hlc.increment() 
          }
        })
      }, 200)

      // 2. PERSISTENCE SAVE (500ms) - Commit to database
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        onChange?.(markdown)
      }, 500)
    },
    onFocus: () => {
      setFocusedNoteId(id)
    },
    onBlur: () => {
      setFocusedNoteId(null)
      // Immediate save on blur
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor?.storage as any)?.markdown?.getMarkdown() || ''
      onChange?.(markdown)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[calc(100vh-300px)] pt-0 pb-32 text-[#E1E2E4] text-[15px] leading-[1.6] [&>*:first-child]:mt-0 font-sans selection:bg-[#4B7BFF]/30 selection:text-white prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-white prose-p:text-[#A1A3A7] prose-strong:text-white prose-blockquote:border-[#4B7BFF]/40 prose-blockquote:text-[#A1A3A7] prose-code:text-[#4B7BFF] prose-code:bg-[#4B7BFF]/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none',
      },
    },
  })

  // Sync content when it changes externally (e.g. switching notes)
  useEffect(() => {
    if (!editor) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentMarkdown = (editor.storage as any).markdown?.getMarkdown()
    
    // FOCUS GUARD: Only update editor content if it's different.
    // We allow updates if:
    // 1. Editor is not focused OR
    // 2. User is idle (hasn't typed for 3s)
    if (content !== undefined && content !== currentMarkdown) {
      if (!editor.isFocused || isIdle) {
        // preserve selection if possible or just reset
        const { from, to } = editor.state.selection
        editor.commands.setContent(content || '')
        // Selection might be invalid if content changed significantly, but try to restore
        try { editor.commands.setTextSelection({ from, to }) } catch { /* ignore */ }
      }
    }
  }, [content, editor, isIdle])

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
