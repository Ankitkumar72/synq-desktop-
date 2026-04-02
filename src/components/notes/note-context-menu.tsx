"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  Star, 
  Link as LinkIcon, 
  Copy, 
  Edit3, 
  Move, 
  Trash2, 
  RefreshCw, 
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Note } from "@/types"
import { formatRelativeDate } from "@/lib/utils/date-utils"

interface NoteContextMenuProps {
  note: Note
  children: React.ReactNode
  onAction: (action: string, noteId: string) => void
}

interface MenuItemProps {
  icon: React.ElementType
  label: string
  shortcut?: string
  onClick: () => void
  variant?: "default" | "danger"
}

const MenuItem = ({ 
  icon: Icon, 
  label, 
  shortcut, 
  onClick, 
  variant = "default" 
}: MenuItemProps) => (
  <button
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
    className={cn(
      "w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium transition-all rounded-md group text-left",
      variant === "danger" 
        ? "text-rose-500 hover:bg-rose-50" 
        : "text-stone-700 hover:bg-stone-100/80 hover:text-black"
    )}
  >
    <div className="flex items-center gap-2.5">
      <Icon className={cn("w-4 h-4", variant === "danger" ? "text-rose-500/70" : "text-stone-400 group-hover:text-stone-900")} />
      {label}
    </div>
    {shortcut && <span className="text-[10px] text-stone-400 font-mono tracking-tighter group-hover:text-stone-500">{shortcut}</span>}
  </button>
)

export function NoteContextMenu({ note, children, onAction }: NoteContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsOpen(true)
    
    // Ensure menu doesn't go off-screen
    const x = e.clientX
    const y = e.clientY
    const menuWidth = 260
    const menuHeight = 350
    
    const posX = x + menuWidth > window.innerWidth ? x - menuWidth : x
    const posY = y + menuHeight > window.innerHeight ? y - menuHeight : y
    
    setPosition({ x: posX, y: posY })
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClick)
      window.addEventListener("scroll", () => setIsOpen(false), { capture: true })
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClick)
      window.removeEventListener("scroll", () => setIsOpen(false), { capture: true })
    }
  }, [isOpen])

  const performAction = (action: string) => {
    onAction(action, note.id)
    setIsOpen(false)
  }

  return (
    <div onContextMenu={handleContextMenu} className="relative">
      {children}
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{ 
              position: "fixed", 
              top: position.y, 
              left: position.x,
              zIndex: 9999 
            }}
            className="w-[260px] bg-white border border-stone-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] p-1.5 backdrop-blur-xl"
          >
            <div className="px-3 py-1.5 mb-1.5 flex flex-col gap-0.5 border-b border-stone-100 pb-2">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Page</span>
            </div>
            
            <div className="space-y-0.5">
              <MenuItem 
                icon={Star} 
                label={note.pinned ? "Remove from Favorites" : "Add to Favorites"} 
                onClick={() => performAction("pin")} 
              />
              <MenuItem 
                icon={LinkIcon} 
                label="Copy link" 
                onClick={() => performAction("copy")} 
              />
              <MenuItem 
                icon={Copy} 
                label="Duplicate" 
                shortcut="Ctrl+D" 
                onClick={() => performAction("duplicate")} 
              />
              <MenuItem 
                icon={Edit3} 
                label="Rename" 
                shortcut="Ctrl+Shift+R" 
                onClick={() => performAction("rename")} 
              />
              <MenuItem 
                icon={Move} 
                label="Move to" 
                shortcut="Ctrl+Shift+P" 
                onClick={() => performAction("move")} 
              />
              <MenuItem 
                icon={Trash2} 
                label="Move to Trash" 
                variant="danger"
                onClick={() => performAction("delete")} 
              />
            </div>
            
            <div className="my-1.5 border-t border-stone-100" />
            
            <div className="space-y-0.5">
              <MenuItem 
                icon={RefreshCw} 
                label="Turn into wiki" 
                onClick={() => performAction("wiki")} 
              />
              <MenuItem 
                icon={ExternalLink} 
                label="Open in new tab" 
                shortcut="Ctrl+Shift+↵"
                onClick={() => performAction("open-new")} 
              />
            </div>
            
            <div className="mt-2 pt-2 border-t border-stone-100 px-3">
              <p className="text-[10px] text-stone-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Last edited by Ankit Kumar</p>
              <p className="text-[10px] text-stone-500 uppercase tracking-tighter">{formatRelativeDate(note.updated_at)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
