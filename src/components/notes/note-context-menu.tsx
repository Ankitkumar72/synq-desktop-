"use client"

import React, { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Note } from "@/shared"
import { formatRelativeDate } from "@/lib/utils/date-utils"

interface NoteContextMenuProps {
  note: Note
  children: React.ReactNode
  onAction: (action: string, noteId: string) => void
}

interface MenuItemProps {
  label: string
  shortcut?: string
  onClick: () => void
  variant?: "default" | "danger"
}

const MenuItem = ({ 
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
      "relative flex w-full cursor-default select-none items-center justify-between rounded-md px-3 py-1.5 text-[13px] outline-none transition-colors",
      variant === "danger" 
        ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10" 
        : "text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
    )}
  >
    <span>{label}</span>
    {shortcut && <span className="text-xs tracking-widest text-muted-foreground">{shortcut}</span>}
  </button>
)

export function NoteContextMenu({ note, children, onAction }: NoteContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsOpen(true)
    
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
              zIndex: 9999,
              fontFamily: '"Google Sans", Roboto, sans-serif'
            }}
            className="w-56 bg-popover border border-border rounded-lg shadow-md p-1 flex flex-col z-50 text-popover-foreground"
          >
            <div className="flex flex-col">
              <MenuItem 
                label={note.pinned ? "Remove from Favorites" : "Add to Favorites"} 
                onClick={() => performAction("pin")} 
              />
              <MenuItem 
                label="Copy link" 
                onClick={() => performAction("copy")} 
              />
              <MenuItem 
                label="Duplicate" 
                shortcut="Ctrl+D" 
                onClick={() => performAction("duplicate")} 
              />
              <MenuItem 
                label="Rename" 
                shortcut="Ctrl+Shift+R" 
                onClick={() => performAction("rename")} 
              />
              <MenuItem 
                label="Move to" 
                shortcut="Ctrl+Shift+P" 
                onClick={() => performAction("move")} 
              />
              <MenuItem 
                label="Move to Trash" 
                variant="danger"
                onClick={() => performAction("delete")} 
              />
            </div>
            
            <div className="-mx-1 my-1 h-px bg-border" />
            
            <div className="flex flex-col">
              <MenuItem 
                label="Turn into Wiki" 
                onClick={() => performAction("wiki")} 
              />
              <MenuItem 
                label="Open in New Tab" 
                shortcut="CMD+ENTER"
                onClick={() => performAction("open-new")} 
              />
            </div>
            
            <div className="-mx-1 mt-1 border-t border-border pt-2 px-2 pb-1">
              <p className="text-xs text-muted-foreground font-medium whitespace-nowrap overflow-hidden text-ellipsis">Ankit Kumar</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{formatRelativeDate(note.updated_at)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
