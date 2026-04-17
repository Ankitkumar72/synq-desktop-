"use client"

import { useEffect, useRef } from "react"
import { Search, Command } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { UserNav } from "./user-nav"

export function Navbar() {
  const searchInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])



  return (
    <div 
      className="h-16 border-b border-white/5 bg-background/50 backdrop-blur-xl sticky top-0 z-30 px-8 flex items-center justify-between transition-colors duration-300"
    >
      <div className="flex items-center justify-center gap-4 flex-1">
        <div className="relative w-full max-w-xl group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 group-focus-within:text-blue-500 transition-colors" />
          <Input 
            ref={searchInputRef}
            placeholder="Search tasks, projects, notes..." 
            className={cn(
              "pl-11 pr-16 bg-white/[0.03] border-white/5 focus-visible:ring-1 focus-visible:ring-blue-500/30",
              "focus-visible:bg-white/[0.07] focus-visible:border-blue-500/20 transition-all h-10",
              "text-[13px] text-stone-100 placeholder:text-stone-600 rounded-xl"
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/5 pointer-events-none opacity-40 group-focus-within:opacity-0 transition-opacity">
            <Command className="w-2.5 h-2.5" />
            <span className="text-[9px] font-black tracking-tighter">K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <UserNav />
      </div>
    </div>
  )
}
