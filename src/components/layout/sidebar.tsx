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
  { name: "Dashboard", href: "/", icon: Home },
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
    <aside className="w-[72px] bg-[#090909] border-r border-[#1F1F1F] flex flex-col items-center py-6 shrink-0 relative z-40">

      {/* User Profile */}
      <div className="mb-8 relative">
        <Avatar className="w-8 h-8 rounded-full border-none bg-[#7B46CE]" size="sm">
          <AvatarImage src={user?.user_metadata?.avatar_url} alt={name} loading="eager" />
          <AvatarFallback className="rounded-full font-medium text-[13px] text-white bg-[#7B46CE]">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Search */}
      <button 
        onClick={openSearch}
        className="text-[#888888] hover:text-white transition-colors mb-6"
      >
        <Search className="w-[22px] h-[22px]" strokeWidth={1.5} />
      </button>

      {/* Divider */}
      <div className="w-8 h-[1px] bg-[#1F1F1F] mb-6"></div>

      {/* Navigation */}
      <nav className="flex flex-col gap-8 flex-1 items-center w-full">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.name} href={item.href}>
              <div className={cn(
                "flex items-center justify-center transition-colors relative",
                isActive
                  ? "text-white"
                  : "text-[#888888] hover:text-white"
              )}>
                <Icon className="w-[22px] h-[22px]" strokeWidth={1.5} />
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-6 items-center mt-auto pb-2">
        <Link href="/trash">
          <div className={cn(
            "w-[46px] h-[46px] rounded-[18px] flex items-center justify-center transition-colors",
            pathname === "/trash" ? "bg-[#1F1F1F] text-white" : "bg-[#1F1F1F]/60 text-[#888888] hover:bg-[#1F1F1F] hover:text-white"
          )}>
            <Trash2 className="w-[22px] h-[22px]" strokeWidth={1.5} />
          </div>
        </Link>

        <button
          onClick={openSettings}
          className="text-[#888888] hover:text-white transition-colors mt-2"
        >
          <Settings className="w-[22px] h-[22px]" strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  )
}