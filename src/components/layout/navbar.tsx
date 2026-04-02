"use client"

import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QuickCreateModal } from "./quick-create"

import { usePathname } from "next/navigation"

export function Navbar() {
  const pathname = usePathname()

  if (pathname.startsWith("/notes")) return null

  return (
    <div className="h-16 border-b border-stone-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input 
            placeholder="Search tasks, projects, notes..." 
            className="pl-10 bg-stone-50/50 border-transparent focus-visible:bg-white focus-visible:border-stone-200 transition-all h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="mr-2 text-stone-400 text-xs font-medium">
          6 members
        </div>
        
        <Button variant="ghost" size="icon" className="relative text-stone-500 hover:text-black">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </Button>

        <QuickCreateModal />
      </div>
    </div>
  )
}
