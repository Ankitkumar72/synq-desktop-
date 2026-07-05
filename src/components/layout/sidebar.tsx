"use client"

import {
  Settings,
  Home,
  Calendar,
  FileText,
  Search,
  Folder,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUserStore } from "@/shared"
import { useUIStore } from "@/shared"


import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getUserDisplayName, getUserInitials } from "@/lib/user-utils"

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: Home },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Notes", href: "/notes", icon: FileText },
  { name: "Folders", href: "/folders", icon: Folder },
]

export function LinearSidebar() {
  const pathname = usePathname()
  const user = useUserStore(s => s.user)
  const openSettings = useUIStore(s => s.openSettings)
  const openSearch = useUIStore(s => s.openSearch)
  const name = getUserDisplayName(user)
  const initials = getUserInitials(user)

  return (
    <aside className="w-[72px] bg-[#090909] flex flex-col items-center py-6 shrink-0 relative z-40">

      {/* User Profile */}
      <Link href="/account" className="mb-8 relative transition-transform hover:scale-105 active:scale-95 block">
        <Avatar className="w-8 h-8 rounded-full border-none bg-[#7B46CE]" size="sm">
          <AvatarImage src={user?.user_metadata?.avatar_url} alt={name} loading="eager" />
          <AvatarFallback className="rounded-full font-medium text-[13px] text-white bg-[#7B46CE]">
            {initials}
          </AvatarFallback>
        </Avatar>
      </Link>

      {/* Search */}
      <button 
        onClick={openSearch}
        className="flex flex-col items-center justify-center gap-1.5 text-[#888888] hover:text-white transition-colors mb-8 w-full"
      >
        <Search className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <span className="text-[12px] font-medium">Search</span>
      </button>

      {/* Navigation */}
      <nav className="flex flex-col gap-8 flex-1 items-center w-full">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.name} href={item.href} className="w-full">
              <div className={cn(
                "flex flex-col items-center justify-center gap-1.5 transition-colors relative",
                isActive
                  ? "text-white"
                  : "text-[#888888] hover:text-white"
              )}>
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                <span className="text-[12px] font-medium">{item.name}</span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-8 items-center mt-auto pb-6 w-full">
        <Link href="/trash" className="w-full">
          <div className={cn(
            "flex flex-col items-center justify-center gap-1.5 transition-colors relative",
            pathname === "/trash" ? "text-white" : "text-[#888888] hover:text-white"
          )}>
            <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
            <span className="text-[12px] font-medium">Trash</span>
          </div>
        </Link>

        <button
          onClick={openSettings}
          className="flex flex-col items-center justify-center gap-1.5 text-[#888888] hover:text-white transition-colors w-full"
        >
          <Settings className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="text-[12px] font-medium">Settings</span>
        </button>
      </div>
    </aside>
  )
}