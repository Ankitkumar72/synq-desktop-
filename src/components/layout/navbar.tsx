"use client"

import { Search, LayoutDashboard, Calendar, FileText, User } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_LINKS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Notes", href: "/notes", icon: FileText },
  { name: "Account", href: "/account", icon: User },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="h-16 border-b border-white/5 bg-background/50 backdrop-blur-xl sticky top-0 z-30 px-8 flex items-center justify-between">
      {/* Left: Logo & Company Name */}
      <div className="flex items-center w-[250px]">
        <span className="font-playfair text-[40px] font-bold tracking-[-0.5px] text-white leading-none mb-1 cursor-default">
          Synq.
        </span>
      </div>

      {/* Center: Navigation Buttons */}
      <div className="flex items-center bg-white/[0.03] border border-white/5 p-1 rounded-2xl">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-bold transition-all duration-300",
                isActive 
                  ? "bg-white/10 text-white shadow-sm shadow-black/20" 
                  : "text-stone-500 hover:text-stone-200"
              )}
            >
              <link.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-stone-600")} />
              {link.name}
            </Link>
          )
        })}
      </div>

      {/* Right: Search Button */}
      <div className="flex items-center justify-end w-[200px]">
        <button className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all group">
          <Search className="w-4 h-4 text-stone-500 group-hover:text-blue-500 transition-colors" />
          <span className="text-[12px] font-bold text-stone-500 group-hover:text-stone-200">Search</span>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/5 ml-2">
            <span className="text-[9px] font-black tracking-tighter text-stone-600">⌘K</span>
          </div>
        </button>
      </div>
    </nav>
  )
}
