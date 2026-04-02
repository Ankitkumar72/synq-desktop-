"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  BarChart2, 
  CheckSquare, 
  Home, 
  Settings, 
  StickyNote,
  PanelLeft,
  Folder,
  Calendar,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"



import Image from "next/image"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useProjectStore } from "@/lib/store/use-project-store"
import { useUserStore } from "@/lib/store/use-user-store"
import { useUIStore } from "@/lib/store/use-ui-store"
import { useHasMounted } from "@/hooks/use-has-mounted"

export function Sidebar() {
  const pathname = usePathname()
  const { tasks } = useTaskStore()
  const { projects } = useProjectStore()
  const { user } = useUserStore()
  const { isSidebarOpen, toggleSidebar } = useUIStore()
  const hasMounted = useHasMounted()

  if (!hasMounted) return null

  const favoriteProjects = projects.filter(p => p.is_favorite)

  const sidebarItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Tasks", href: "/tasks", icon: CheckSquare, badge: tasks.length },
    { name: "Folders", href: "/projects", icon: Folder, badge: projects.length },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Notes", href: "/notes", icon: StickyNote },
    { name: "Reports", href: "/reports", icon: BarChart2 },
  ]

  return (
    <AnimatePresence mode="wait">
      {isSidebarOpen && (
        <motion.div 
          initial={{ width: 0, opacity: 0, x: -256 }}
          animate={{ width: 280, opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: -280 }}
          transition={{ type: "spring", damping: 25, stiffness: 150, mass: 0.8 }}
          className="flex flex-col h-screen border-r border-[#eee] bg-white overflow-hidden relative z-40"
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center relative">
                <Image 
                  src="/logo.png" 
                  alt="Synq Logo" 
                  fill 
                  className="object-contain scale-[1.3]" 
                  priority
                />
              </div>
              <span className="font-bold text-xl tracking-tight text-stone-900">Synq</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleSidebar}
              className="h-9 w-9 text-stone-400 hover:text-stone-900 transition-all hover:bg-stone-50 rounded-lg group"
              title="Close Sidebar"
            >
              <PanelLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </Button>
          </div>


          <ScrollArea className="flex-1">
            <nav className="space-y-0.5">
              {sidebarItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-6 py-2.5 transition-all text-base font-medium group relative",
                    pathname === item.href 
                      ? "bg-stone-50/80 text-stone-900" 
                      : "text-stone-500 hover:text-stone-900 hover:bg-stone-50/30"
                  )}
                >
                  {pathname === item.href && (
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#6366f1]" />
                  )}
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("w-5 h-5 transition-colors", pathname === item.href ? "text-stone-900" : "text-stone-400 group-hover:text-stone-900")} />
                    {item.name}
                  </div>
                  {item.badge !== undefined && (
                    <span className={cn(
                      "font-mono text-xs tracking-tighter text-stone-900",
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {favoriteProjects.length > 0 && (
              <div className="mt-8">
                <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-black mb-3 px-6 opacity-40">Favorites</h3>
                <div className="space-y-0.5">
                  {favoriteProjects.map(project => (
                    <Link 
                      key={project.id}
                      href={`/projects`} 
                      className="flex items-center gap-3 px-6 py-2 text-base text-stone-600 hover:text-stone-900 hover:bg-stone-50/30 transition-all font-medium"
                    >
                      <div className={cn("w-2 h-2 rounded-full", project.color)} />
                      {project.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>

          <div className="mt-auto border-t border-stone-100">
            <Link
              href="/trash"
              className={cn(
                "flex items-center gap-3 px-6 py-3 transition-all text-base font-medium group text-stone-500 hover:text-stone-900 hover:bg-stone-50/50"
              )}
            >
              <Trash2 className="w-5 h-5 text-stone-400 group-hover:text-stone-900 transition-colors" />
              Trash
            </Link>
          </div>

          <div className="p-4 border-t border-stone-100">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-stone-50 transition-all group cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-black text-stone-600 border border-stone-200 shadow-sm transition-transform group-hover:scale-105">
                {user.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-stone-900 truncate leading-tight">{user.name}</p>
                <p className="text-[13px] text-stone-500 font-medium truncate">{user.email}</p>
              </div>
              <Settings className="w-5 h-5 text-stone-400 hover:text-stone-900 transition-colors" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
