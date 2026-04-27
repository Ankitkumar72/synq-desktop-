"use client"

import {
  Plus,
  Settings,
  LayoutDashboard,
  Calendar,
  FileText,
  Search,
  Folder,
  Layers,
  BookOpen,
  Tag,
  Users,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUserStore } from "@/lib/store/use-user-store"
import { useUIStore } from "@/lib/store/use-ui-store"
import { QuickCreateModal } from "./quick-create"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getUserDisplayName, getUserInitials } from "@/lib/user-utils"

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Notes", href: "/notes", icon: FileText },
]

export function LinearSidebar() {
  const pathname = usePathname()
  const { user } = useUserStore()
  const { openSettings } = useUIStore()
  const name = getUserDisplayName(user)
  const initials = getUserInitials(user)

  return (
    <aside className="w-[280px] bg-[#090909] border-r border-[#2E2E2E] flex flex-col p-4 shrink-0 relative z-40">
      
      {/* User Profile */}
      <div className="flex items-center gap-3 mb-6 p-2">
        <div className="relative">
          <Avatar className="w-[30px] h-[30px] rounded-lg border-none bg-[#262626]" size="sm">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt={name} loading="eager" />
            <AvatarFallback className="rounded-lg font-bold text-white bg-[#262626]">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* Online Indicator */}
          <span className="absolute w-2 h-2 bg-[#04C40A] rounded-full -bottom-0.5 -right-0.5 border-2 border-[#090909] z-10"></span>
        </div>
        <span className="font-bold text-[16px] text-white truncate">{name}</span>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between bg-[#1F1F1F] border border-[#2E2E2E] rounded-lg px-3 py-1.5 mb-6 text-[#999999] cursor-pointer hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2 text-[13px]">
          <Search className="w-4 h-4" /> Quick Search
        </div>
        <div className="border border-[#444444] rounded px-1.5 text-[10px] font-mono">⌘F</div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.name} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-colors",
                isActive 
                  ? "bg-[#1F1F1F] text-white" 
                  : "text-[#999999] hover:bg-[#1F1F1F] hover:text-white"
              )}>
                <Icon className="w-4 h-4" />
                <span className="text-[13px] font-medium">{item.name}</span>
              </div>
            </Link>
          )
        })}
        
        <div className="my-4 border-t border-[#2E2E2E]"></div>
        
        <SidebarItem icon={<Folder className="w-4 h-4" />} label="Files" />
        <SidebarItem icon={<Layers className="w-4 h-4" />} label="Templates" />
        <SidebarItem icon={<BookOpen className="w-4 h-4" />} label="Notebooks" />
        <SidebarItem icon={<Tag className="w-4 h-4" />} label="Tags" />
        <SidebarItem icon={<Users className="w-4 h-4" />} label="Shared" />
      </nav>

      {/* Bottom Actions */}
      <div className="pt-4 border-t border-[#2E2E2E] space-y-1">
        <Link href="/trash">
          <div className={cn(
            "flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-colors mb-1",
            pathname === "/trash" ? "bg-[#1F1F1F] text-white" : "text-[#999999] hover:bg-[#1F1F1F] hover:text-white"
          )}>
            <Trash2 className="w-4 h-4" />
            <span className="text-[13px] font-medium">Trash</span>
          </div>
        </Link>
        <QuickCreateModal trigger={
          <button className="w-full flex items-center gap-3 px-4 py-2 text-[#999999] hover:bg-[#1F1F1F] hover:text-white rounded-lg transition-colors text-[13px] font-medium">
            <Plus className="w-4 h-4" />
            <span>New Page</span>
          </button>
        } />
        <button 
          onClick={openSettings}
          className="w-full flex items-center gap-3 px-4 py-2 text-[#999999] hover:bg-[#1F1F1F] hover:text-white rounded-lg transition-colors text-[13px] font-medium"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}

function SidebarItem({ icon, label, href, isActive }: { icon: React.ReactNode; label: string; href?: string; isActive?: boolean }) {
  const content = (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-colors",
      isActive ? "bg-[#1F1F1F] text-white" : "text-[#999999] hover:bg-[#1F1F1F] hover:text-white"
    )}>
      <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
      <span className="text-[13px] font-medium">{label}</span>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}