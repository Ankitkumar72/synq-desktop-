"use client"

import React, { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Folder } from "@/shared"

interface FolderContextMenuProps {
  folder: Folder
  children: React.ReactNode
  onAction: (action: string, folderId: string) => void
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
    {shortcut && <span className="text-[10px] tracking-widest text-muted-foreground uppercase font-medium">{shortcut}</span>}
  </button>
)

export function FolderContextMenu({ folder, children, onAction }: FolderContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsOpen(true)
    
    // Ensure menu doesn't go off-screen
    const x = e.clientX
    const y = e.clientY
    const menuWidth = 240
    const menuHeight = 220
    
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
    onAction(action, folder.id)
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
            className="w-48 bg-popover border border-border rounded-lg shadow-md p-1 flex flex-col z-50 text-popover-foreground"
          >
            <MenuItem 
              label="Expand / Collapse" 
              onClick={() => performAction("open")} 
            />
            <MenuItem 
              label={folder.is_favorite ? "Unpin Folder" : "Pin Folder"} 
              onClick={() => performAction("pin")} 
            />
            <MenuItem 
              label="Rename" 
              onClick={() => performAction("rename")} 
            />
            <MenuItem 
              label="Edit Description" 
              onClick={() => performAction("edit-description")} 
            />
            
            <div className="-mx-1 my-1 h-px bg-border" />
            
            <MenuItem 
              label="Move to Trash" 
              variant="danger"
              onClick={() => performAction("delete")} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
