"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, ListChecks, FolderDot,
  CalendarDays, FileText, BarChart3, Trash
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion } from "framer-motion"
import Image from "next/image"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useProjectStore } from "@/lib/store/use-project-store"
import { useUserStore } from "@/lib/store/use-user-store"
import { useUIStore } from "@/lib/store/use-ui-store"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { SettingsModal } from "@/components/layout/settings-modal"

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  showBadge?: "tasks" | "projects"
}

const NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: ListChecks, showBadge: "tasks" },
  { name: "Folders", href: "/projects", icon: FolderDot, showBadge: "projects" },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Notes", href: "/notes", icon: FileText },
  { name: "Reports", href: "/reports", icon: BarChart3 },
]

const TRANSITION = { type: "tween", duration: 0.15, ease: [0.16, 1, 0.3, 1] } as const

// Shared animation props for all collapsible text/label elements.
// Keeps them mounted at all times — avoids DOM mount/unmount CPU spikes.
// overflow-hidden on the wrapper does the clipping; width+opacity do the reveal.
const textReveal = (expanded: boolean) => ({
  initial: false,
  animate: {
    width: expanded ? "auto" : 0,
    opacity: expanded ? 1 : 0,
  },
  transition: TRANSITION,
})

export function Sidebar() {
  const pathname = usePathname()
  const { tasks } = useTaskStore()
  const { projects } = useProjectStore()
  const { user } = useUserStore()
  const { isSidebarOpen } = useUIStore()
  const [hovered, setHovered] = React.useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  const hasMounted = useHasMounted()

  if (!hasMounted) return null

  const expanded = isSidebarOpen || hovered
  const favoriteProjects = projects.filter(p => p.is_favorite)

  const badgeCount = { tasks: tasks.length, projects: projects.length } as Record<string, number>

  const initials = (user?.user_metadata?.full_name || user?.email)
    ?.split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() ?? "?"

  return (

    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 240 : 64 }}
      transition={TRANSITION}
      style={{ willChange: "width" }}
      className="h-screen shrink-0 relative z-40"
      aria-label="Sidebar"
    >
      <motion.div
        initial={false}
        animate={{ width: expanded ? 240 : 64 }}
        transition={TRANSITION}
        style={{ willChange: "width" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col border-r border-border bg-sidebar overflow-hidden",
          !isSidebarOpen && expanded && "shadow-2xl shadow-black/40 border-white/20"
        )}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className={cn("p-4 flex items-center", expanded ? "justify-between" : "justify-center")}>
          {/* Logo + "Synq" wordmark */}
          <div className="flex items-center gap-0 min-w-0 relative">
            <div className="w-6 h-6 relative shrink-0">
              <Image
                src="/brand-logo.png"
                alt="Synq"
                fill
                sizes="96px"
                className="object-contain"
                quality={100}
                unoptimized
                priority
              />
            </div>

            <motion.div
              {...textReveal(expanded)}
              style={{ marginLeft: expanded ? 10 : 0, willChange: "width, opacity" }}
              className="overflow-hidden whitespace-nowrap"
            >
              <span className="font-bold text-[17px] tracking-tight text-white leading-none">
                Synq
              </span>
            </motion.div>
          </div>


        </div>


        {/* ── Nav Items ────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 mt-2">
          <nav className="space-y-0.5" aria-label="Main navigation">
            {NAV_ITEMS.map(({ name, href, icon: Icon, showBadge }) => {
              const active = pathname === href
              const badge = showBadge ? badgeCount[showBadge] : undefined
              return (
                <Link
                  key={name}
                  href={href}
                  title={!expanded ? name : undefined}
                  className={cn(
                    "flex items-center px-4 py-2 text-[14px] font-medium transition-colors group",
                    active
                      ? "bg-white/5 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center min-w-0">
                    <Icon className={cn(
                      "w-[18px] h-[18px] shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-stone-300"
                    )} />

                    {/* FIX: Nav label — no AnimatePresence, animate width+opacity */}
                    <motion.div
                      initial={false}
                      animate={{
                        width: expanded ? "auto" : 0,
                        opacity: expanded ? 1 : 0,
                        marginLeft: expanded ? 12 : 0,
                      }}
                      transition={TRANSITION}
                      style={{ willChange: "width, opacity" }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {name}
                    </motion.div>
                  </div>

                  {/* FIX: Badge — no AnimatePresence, animate width+opacity+scale */}
                  {badge !== undefined && (
                    <motion.div
                      initial={false}
                      animate={{
                        width: expanded ? "auto" : 0,
                        opacity: expanded ? 1 : 0,
                        scale: expanded ? 1 : 0.8,
                      }}
                      transition={TRANSITION}
                      style={{ willChange: "width, opacity" }}
                      className="ml-auto overflow-hidden flex items-center justify-end"
                    >
                      <span className={cn(
                        "font-mono text-[10px] font-black tracking-tighter px-2 py-0.5 rounded-md shrink-0",
                        active ? "text-primary bg-primary/10" : "text-muted-foreground bg-white/5"
                      )}>
                        {badge}
                      </span>
                    </motion.div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* ── Favorites ──────────────────────────────────────────── */}
          {favoriteProjects.length > 0 && (
            <div className="mt-8">
              {/* Section label fades out when collapsed */}
              <motion.div
                {...textReveal(expanded)}
                style={{ willChange: "width, opacity" }}
                className="overflow-hidden whitespace-nowrap px-4 mb-2"
              >
                <p className="label-mono">
                  Favorites
                </p>
              </motion.div>

              <div className="space-y-0.5">
                {favoriteProjects.map(project => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center px-4 py-1.5 text-[14px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all font-medium min-w-0"
                  >
                    <div className={cn("w-2 h-2 rounded-full shrink-0", project.color)} />

                    {/* FIX: Project name — keep mounted, animate width/opacity */}
                    <motion.div
                      initial={false}
                      animate={{
                        width: expanded ? "auto" : 0,
                        opacity: expanded ? 1 : 0,
                        marginLeft: expanded ? 12 : 0,
                      }}
                      transition={TRANSITION}
                      style={{ willChange: "width, opacity" }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      <span className="truncate">{project.name}</span>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* ── Trash ────────────────────────────────────────────────── */}
        <div className="border-t border-white/5">
          <Link
            href="/trash"
            title={!expanded ? "Trash" : undefined}
            className={cn(
              "flex items-center transition-all group",
              expanded
                ? "px-4 py-3 text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/5"
                : "py-3 justify-center"
            )}
          >
            <Trash className="w-[18px] h-[18px] text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />

            {/* FIX: "Trash" label — keep mounted, animate width/opacity */}
            <motion.div
              initial={false}
              animate={{
                width: expanded ? "auto" : 0,
                opacity: expanded ? 1 : 0,
                marginLeft: expanded ? 12 : 0,
              }}
              transition={TRANSITION}
              style={{ willChange: "width, opacity" }}
              className="overflow-hidden whitespace-nowrap"
            >
              Trash
            </motion.div>
          </Link>
        </div>

        {/* ── User ─────────────────────────────────────────────────── */}
        <div className="p-3 border-t border-white/5">
          <div 
            onClick={() => setIsSettingsOpen(true)}
            className={cn(
            "p-2 rounded-xl hover:bg-white/5 transition-all group cursor-pointer border border-transparent hover:border-white/5 flex items-center",
            expanded ? "" : "justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 shadow-lg flex items-center justify-center text-[9px] font-black text-stone-100 uppercase shrink-0 transition-transform group-hover:scale-105">
              {initials}
            </div>

            {/* FIX: User name + role — keep mounted, animate width/opacity */}
            <motion.div
              initial={false}
              animate={{
                width: expanded ? "auto" : 0,
                opacity: expanded ? 1 : 0,
                marginLeft: expanded ? 10 : 0,
              }}
              transition={TRANSITION}
              style={{ willChange: "width, opacity" }}
              className="overflow-hidden whitespace-nowrap"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-white truncate leading-tight tracking-tight">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"}
                </p>
                <p className="text-[11px] text-stone-500 font-medium truncate">Owner</p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </motion.aside>
  )
}