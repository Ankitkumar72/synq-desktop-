"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  Pin,
  PinOff,
  FolderOpen, 
  Edit3, 
  AlignLeft,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Folder } from "@/shared"

interface FolderContextMenuProps {
  folder: Folder
  children: React.ReactNode
  onAction: (action: string, folderId: string) => void
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
      "w-full flex items-center justify-between px-2 py-1.5 text-[13px] transition-colors rounded-sm text-left select-none outline-none",
      variant === "danger" 
        ? "text-rose-400 hover:bg-rose-500/10 hover:text-rose-400" 
        : "text-stone-300 hover:bg-white/10 hover:text-white"
    )}
  >
    <div className="flex items-center gap-2">
      <Icon className={cn("w-4 h-4", variant === "danger" ? "text-rose-400" : "text-stone-400")} />
      {label}
    </div>
    {shortcut && <span className="text-[10px] text-stone-500 tracking-widest">{shortcut}</span>}
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
              zIndex: 9999 
            }}
            className="w-[200px] bg-[#1e1e1e] border border-white/10 rounded-md shadow-2xl p-1"
          >
            <MenuItem 
              icon={FolderOpen} 
              label="Expand / Collapse" 
              onClick={() => performAction("open")} 
            />
            <MenuItem 
              icon={folder.is_favorite ? PinOff : Pin} 
              label={folder.is_favorite ? "Unpin Folder" : "Pin Folder"} 
              onClick={() => performAction("pin")} 
            />
            <MenuItem 
              icon={Edit3} 
              label="Rename" 
              onClick={() => performAction("rename")} 
            />
            <MenuItem 
              icon={AlignLeft} 
              label="Edit Description" 
              onClick={() => performAction("edit-description")} 
            />
            
            <div className="h-px bg-white/10 my-1 mx-0" />
            
            <MenuItem 
              icon={Trash2} 
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
