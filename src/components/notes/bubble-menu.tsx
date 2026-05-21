"use client"

import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react/menus'
import { Editor } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Palette,
  Check,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NoteBubbleMenuProps {
  editor: Editor | null
}

const TEXT_COLORS = [
  { name: 'default', label: 'Default', value: null, dot: 'bg-neutral-300' },
  { name: 'gray', label: 'Gray', value: '#8A8B8F', dot: 'bg-[#8A8B8F]' },
  { name: 'blue', label: 'Blue', value: '#4B7BFF', dot: 'bg-[#4B7BFF]' },
  { name: 'green', label: 'Green', value: '#10B981', dot: 'bg-[#10B981]' },
  { name: 'yellow', label: 'Yellow', value: '#F59E0B', dot: 'bg-[#F59E0B]' },
  { name: 'red', label: 'Red', value: '#EF4444', dot: 'bg-[#EF4444]' },
  { name: 'purple', label: 'Purple', value: '#8B5CF6', dot: 'bg-[#8B5CF6]' },
]

const HIGHLIGHT_COLORS = [
  { name: 'none', label: 'None', value: null, dot: 'border border-neutral-700 bg-transparent' },
  { name: 'gray', label: 'Gray highlight', value: '#2D2F33', dot: 'bg-[#2D2F33]' },
  { name: 'blue', label: 'Blue highlight', value: 'rgba(75, 123, 255, 0.15)', dot: 'bg-blue-500/25' },
  { name: 'green', label: 'Green highlight', value: 'rgba(16, 185, 129, 0.15)', dot: 'bg-emerald-500/25' },
  { name: 'yellow', label: 'Yellow highlight', value: 'rgba(245, 158, 11, 0.15)', dot: 'bg-amber-500/25' },
  { name: 'red', label: 'Red highlight', value: 'rgba(239, 68, 68, 0.15)', dot: 'bg-rose-500/25' },
  { name: 'purple', label: 'Purple highlight', value: 'rgba(139, 92, 246, 0.15)', dot: 'bg-violet-500/25' },
]

export function NoteBubbleMenu({ editor }: NoteBubbleMenuProps) {
  const [isEditingLink, setIsEditingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showColors, setShowColors] = useState(false)
  
  const menuContainerRef = useRef<HTMLDivElement>(null)
  const colorMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return

    // Sync linkUrl when selection changes and has active link
    const handleSelectionUpdate = () => {
      if (editor.isActive('link')) {
        const attrs = editor.getAttributes('link')
        setLinkUrl(attrs.href || '')
      } else {
        setLinkUrl('')
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor])

  // Handle click outside color dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
        setShowColors(false)
      }
    }
    if (showColors) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColors])

  if (!editor) return null

  const shouldShow = ({
    state,
    editor,
  }: {
    state: import('@tiptap/pm/state').EditorState
    editor: Editor
  }) => {
    const isInputActive =
      document.activeElement &&
      menuContainerRef.current?.contains(document.activeElement)

    if (isInputActive || isEditingLink || showColors) {
      return true
    }

    const { selection } = state
    const isTextSelection = !selection.empty

    // Never show bubble menu inside code blocks
    if (editor.isActive('codeBlock')) {
      return false
    }

    return !!(isTextSelection && editor.isEditable)
  }

  const handleLinkClick = () => {
    if (editor.isActive('link')) {
      // Pre-fill link URL if active
      const attrs = editor.getAttributes('link')
      setLinkUrl(attrs.href || '')
    } else {
      setLinkUrl('')
    }
    setIsEditingLink(true)
    setShowColors(false)
  }

  const handleLinkSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (linkUrl.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      let formattedUrl = linkUrl.trim()
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: formattedUrl }).run()
    }
    setIsEditingLink(false)
  }

  const handleUnlink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setIsEditingLink(false)
  }

  const applyTextColor = (colorValue: string | null) => {
    if (colorValue === null) {
      editor.chain().focus().unsetColor().run()
    } else {
      editor.chain().focus().setColor(colorValue).run()
    }
    setShowColors(false)
  }

  const applyHighlight = (colorValue: string | null) => {
    if (colorValue === null) {
      editor.chain().focus().unsetHighlight().run()
    } else {
      editor.chain().focus().toggleHighlight({ color: colorValue }).run()
    }
    setShowColors(false)
  }

  return (
    <TiptapBubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      options={{
        placement: 'top',
      }}
    >
      <div
        ref={menuContainerRef}
        className="flex items-center gap-0.5 p-1 bg-neutral-950/95 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-md text-neutral-300 select-none relative"
      >
        {isEditingLink ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5" contentEditable={false}>
            <input
              type="text"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleLinkSubmit()
                if (e.key === 'Escape') setIsEditingLink(false)
              }}
              placeholder="Paste or type link..."
              className="text-xs px-2.5 py-1 w-44 bg-neutral-900 border border-neutral-800 rounded-md text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
              autoFocus
            />
            <button
              onClick={() => handleLinkSubmit()}
              className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500 transition-colors"
              title="Save link"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            {editor.isActive('link') && (
              <button
                onClick={handleUnlink}
                className="px-1.5 py-1 text-[10px] uppercase font-bold text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                title="Remove link"
              >
                Unlink
              </button>
            )}
            <button
              onClick={() => setIsEditingLink(false)}
              className="p-1 rounded hover:bg-white/5 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            {/* Standard Text Formatting Buttons */}
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive('bold') && "bg-white/5 text-white"
              )}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive('italic') && "bg-white/5 text-white"
              )}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive('underline') && "bg-white/5 text-white"
              )}
              title="Underline"
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </button>
            
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive('strike') && "bg-white/5 text-white"
              )}
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive('code') && "bg-white/5 text-white"
              )}
              title="Inline Code"
            >
              <Code className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-neutral-800 mx-1" />

            <button
              onClick={handleLinkClick}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive('link') && "bg-white/5 text-blue-400 hover:text-blue-300"
              )}
              title="Hyperlink"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-neutral-800 mx-1" />

            <button
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive({ textAlign: 'left' }) && "bg-white/5 text-white"
              )}
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive({ textAlign: 'center' }) && "bg-white/5 text-white"
              )}
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                editor.isActive({ textAlign: 'right' }) && "bg-white/5 text-white"
              )}
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-neutral-800 mx-1" />

            <button
              onClick={() => {
                setShowColors(!showColors)
                setIsEditingLink(false)
              }}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-150",
                showColors && "bg-white/5 text-white"
              )}
              title="Colors & Highlights"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            {/* Float Color Dropdown Menu */}
            {showColors && (
              <div
                ref={colorMenuRef}
                contentEditable={false}
                className="absolute top-10 left-1/2 -translate-x-1/2 z-50 w-52 p-2 rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl backdrop-blur-md flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150 text-xs"
              >
                {/* Text Color Selection */}
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 px-2 mb-1.5">
                    Text Color
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {TEXT_COLORS.map(color => (
                      <button
                        key={color.name}
                        onClick={() => applyTextColor(color.value)}
                        className="flex items-center justify-between w-full px-2 py-1 rounded-md text-neutral-300 hover:bg-white/5 hover:text-white transition-all text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", color.dot)} />
                          {color.label}
                        </div>
                        {color.value === null
                          ? !editor.isActive('textStyle', { color: undefined }) && <Check className="w-3 h-3 text-neutral-400" />
                          : editor.isActive('textStyle', { color: color.value }) && <Check className="w-3 h-3 text-neutral-400" />
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {/* Highlight Selection */}
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 px-2 mb-1.5">
                    Background Highlight
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {HIGHLIGHT_COLORS.map(color => (
                      <button
                        key={color.name}
                        onClick={() => applyHighlight(color.value)}
                        className="flex items-center justify-between w-full px-2 py-1 rounded-md text-neutral-300 hover:bg-white/5 hover:text-white transition-all text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", color.dot)} />
                          {color.label}
                        </div>
                        {color.value === null
                          ? !editor.isActive('highlight') && <Check className="w-3 h-3 text-neutral-400" />
                          : editor.isActive('highlight', { color: color.value }) && <Check className="w-3 h-3 text-neutral-400" />
                        }
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TiptapBubbleMenu>
  )
}
