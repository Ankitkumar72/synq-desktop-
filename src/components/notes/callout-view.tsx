"use client"

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Palette, Trash2 } from 'lucide-react'

const CURATED_EMOJIS = ['💡', '📝', '⚠️', '✅', '🎯', '🔥']
const CURATED_COLORS = [
  { name: 'gray', label: 'Default', bg: 'bg-white/[0.02] border-white/[0.05] text-neutral-200', dot: 'bg-neutral-400' },
  { name: 'blue', label: 'Blue', bg: 'bg-blue-500/5 border-blue-500/20 text-blue-200', dot: 'bg-blue-400' },
  { name: 'green', label: 'Green', bg: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200', dot: 'bg-emerald-400' },
  { name: 'yellow', label: 'Yellow', bg: 'bg-amber-500/5 border-amber-500/20 text-amber-200', dot: 'bg-amber-400' },
  { name: 'red', label: 'Red', bg: 'bg-rose-500/5 border-rose-500/20 text-rose-200', dot: 'bg-rose-400' },
  { name: 'purple', label: 'Purple', bg: 'bg-violet-500/5 border-violet-500/20 text-violet-200', dot: 'bg-violet-400' },
]

export function CalloutView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentEmoji = node.attrs.emoji || '💡'
  const currentColorName = node.attrs.color || 'gray'
  const currentColor = CURATED_COLORS.find(c => c.name === currentColorName) || CURATED_COLORS[0]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <NodeViewWrapper className="relative group/callout my-6">
      <div
        className={cn(
          "flex gap-4 p-4 rounded-xl border transition-all duration-300 relative",
          currentColor.bg
        )}
      >
        {/* Actions Button Panel on hover */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/callout:opacity-100 transition-opacity duration-200 pointer-events-auto" contentEditable={false}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded hover:bg-white/5 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Customize Callout"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => deleteNode()}
            className="p-1 rounded hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 transition-colors"
            title="Delete Callout"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Emoji Icon Button */}
        <div
          contentEditable={false}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg hover:bg-white/5 cursor-pointer transition-all duration-200 text-xl select-none"
        >
          {currentEmoji}
        </div>

        {/* Popup Settings Menu */}
        {isOpen && (
          <div
            ref={menuRef}
            contentEditable={false}
            className="absolute top-12 left-4 z-50 w-56 p-2 rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl backdrop-blur-md flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Emojis Preset */}
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 px-2 mb-1.5">
                Emoji Preset
              </div>
              <div className="grid grid-cols-6 gap-1 px-1">
                {CURATED_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      updateAttributes({ emoji })
                      setIsOpen(false)
                    }}
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-md text-base hover:bg-white/10 transition-all active:scale-95",
                      currentEmoji === emoji && "bg-white/5 border border-white/10"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors Preset */}
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 px-2 mb-1.5">
                Color Tint
              </div>
              <div className="grid grid-cols-2 gap-1 px-1">
                {CURATED_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => {
                      updateAttributes({ color: color.name })
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 text-xs rounded-md text-neutral-300 hover:bg-white/5 hover:text-white transition-all text-left",
                      currentColorName === color.name && "bg-white/5 font-medium text-white"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", color.dot)} />
                    {color.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Callout Content Area */}
        <NodeViewContent className="flex-1 min-w-0 prose prose-invert prose-p:my-0 prose-p:text-neutral-300 focus:outline-none" />
      </div>
    </NodeViewWrapper>
  )
}
