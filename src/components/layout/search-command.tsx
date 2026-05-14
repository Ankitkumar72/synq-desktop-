"use client"

import * as React from "react"
import { LucideIcon, Search, CheckCircle, FileText, Folder, User, Users, ArrowRight, Clock, Zap, CheckSquare } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useUIStore, SearchResult } from "@/lib/store/use-ui-store"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useProjectStore } from "@/lib/store/use-project-store"
// import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"

type FilterType = "all" | "tasks" | "projects" | "docs" | "people" | "comments" | "teams" | "commands"

export function SearchCommand() {
  const { isSearchOpen, closeSearch, recentSearches, addRecentSearch } = useUIStore()
  const [query, setQuery] = React.useState("")
  const [activeFilter, setActiveFilter] = React.useState<FilterType>("all")
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const router = useRouter()

  const tasks = useTaskStore((state) => state.tasks)
  const notes = useNotesStore((state) => state.notes)
  const projects = useProjectStore((state) => state.projects)

  // Derived search results
  const filteredResults = React.useMemo<{
    recent?: SearchResult[]
    suggestions?: SearchResult[]
    results?: SearchResult[]
  }>(() => {
    const q = query.toLowerCase()
    const results: SearchResult[] = []

    if (!q) {
      // Show search history (recently visited items)
      // Filter out items that might have been deleted in the meantime
      const validHistory = recentSearches.filter(item => {
        if (item.type === 'task') return tasks.find(t => t.id === item.id && !t.is_deleted)
        if (item.type === 'doc') return notes.find(n => n.id === item.id && !n.is_deleted)
        if (item.type === 'project') return projects.find(p => p.id === item.id && !p.is_deleted)
        return true
      })

      const suggestions: SearchResult[] = [
        { id: 's1', type: 'command', title: 'My tasks', metadata: 'View assigned tasks', icon: CheckSquare, color: 'text-blue-400', bgColor: 'bg-blue-400/10', href: '/tasks' },
        { id: 's2', type: 'command', title: "Projects I'm involved in", metadata: 'View all projects', icon: Folder, color: 'text-yellow-400', bgColor: 'bg-yellow-400/10', href: '/projects' },
        { id: 's3', type: 'command', title: 'Docs I recently edited', metadata: 'View recently edited docs', icon: FileText, color: 'text-purple-400', bgColor: 'bg-purple-400/10', href: '/notes' },
      ]

      return {
        recent: validHistory,
        suggestions
      }
    }

    // Filter logic
    if (activeFilter === "all" || activeFilter === "tasks") {
      tasks.filter(t => t.title.toLowerCase().includes(q) && !t.is_deleted).forEach(t => {
        results.push({ id: t.id, type: 'task', title: t.title, metadata: 'Task', icon: CheckCircle, color: 'text-blue-400', bgColor: 'bg-blue-400/10', href: `/tasks/${t.id}` })
      })
    }
    if (activeFilter === "all" || activeFilter === "docs") {
      notes.filter(n => n.title.toLowerCase().includes(q) && !n.is_deleted).forEach(n => {
        results.push({ id: n.id, type: 'doc', title: n.title, metadata: 'Document', icon: FileText, color: 'text-purple-400', bgColor: 'bg-purple-400/10', href: `/notes/${n.id}` })
      })
    }
    if (activeFilter === "all" || activeFilter === "projects") {
      projects.filter(p => p.name.toLowerCase().includes(q) && !p.is_deleted).forEach(p => {
        results.push({ id: p.id, type: 'project', title: p.name, metadata: 'Project', icon: Folder, color: 'text-yellow-400', bgColor: 'bg-yellow-400/10', href: `/projects/${p.id}` })
      })
    }

    return { results }
  }, [query, activeFilter, tasks, notes, projects, recentSearches])

  // Reset selection when query or filter changes
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [query, activeFilter])

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        // Toggle search is handled by UIStore listener usually, but we can ensure it's open
      }
      
      if (!isSearchOpen) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => prev + 1)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const q = query.toLowerCase()
        let item: SearchResult | undefined = undefined
        
        if (!q) {
          const combined = [...(filteredResults.recent || []), ...(filteredResults.suggestions || [])]
          item = combined[selectedIndex]
        } else {
          item = filteredResults.results?.[selectedIndex]
        }

        if (item) {
          if (item.type !== 'command') addRecentSearch(item)
          if (item.href) router.push(item.href)
          closeSearch()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSearchOpen, query, filteredResults, selectedIndex, addRecentSearch, router, closeSearch])

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "tasks", label: "Tasks" },
    { id: "projects", label: "Projects" },
    { id: "docs", label: "Docs" },
    { id: "people", label: "People" },
    { id: "comments", label: "Comments" },
    { id: "teams", label: "Teams" },
    { id: "commands", label: "Commands" },
  ]

  const QUICK_ACTIONS: { label: string; icon: LucideIcon; shortcut: string; type: 'task' | 'project' | 'note' | 'event' }[] = [
    { label: "New task", icon: CheckSquare, shortcut: "T", type: 'task' },
    { label: "New project", icon: Folder, shortcut: "P", type: 'project' },
    { label: "New doc", icon: FileText, shortcut: "D", type: 'note' },
    { label: "New team", icon: Users, shortcut: "N", type: 'task' },
    { label: "Invite people", icon: User, shortcut: "I", type: 'task' },
  ]

  return (
    <Dialog open={isSearchOpen} onOpenChange={(open) => !open && closeSearch()}>
      <DialogContent 
        showCloseButton={false}
        className="!p-0 !gap-0 !border-none !bg-transparent !shadow-none !ring-0 !max-w-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999]"
        style={{ width: '1100px', maxWidth: '95vw' }}
      >
        <div className="flex h-[650px] w-full overflow-hidden bg-[#0D0D0D] border border-white/10 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl ring-1 ring-white/10">
          {/* Main Content */}
          <div className="flex-1 flex flex-col border-r border-white/5 min-w-0 bg-[#0D0D0D]">
            {/* Search Input */}
            <div className="flex items-center px-6 py-6 gap-4 border-b border-white/5">
              <Search className="w-6 h-6 text-[#666666]" />
              <input
                autoFocus
                placeholder="Search for anything..."
                className="flex-1 bg-transparent border-none outline-none text-white text-xl placeholder-[#444444] font-medium"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex items-center px-4 py-3 gap-2 border-b border-white/5 overflow-x-auto no-scrollbar">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 whitespace-nowrap",
                    activeFilter === filter.id 
                      ? "bg-white/10 text-white shadow-sm" 
                      : "text-[#666666] hover:bg-white/5 hover:text-[#999999]"
                  )}
                >
                  {filter.label}
                </button>
              ))}
              <div className="ml-auto px-4 text-[10px] text-[#444444] flex items-center gap-1">
                <Zap className="w-3 h-3" /> Tab to navigate
              </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-2">
              {query === "" && activeFilter === "all" ? (
                <>
                  {filteredResults.recent && filteredResults.recent.length > 0 && (
                    <div className="mb-6">
                      <div className="px-4 mb-2 flex items-center gap-2 text-[11px] font-bold text-[#444444] uppercase tracking-wider">
                        <Clock className="w-3 h-3" /> Recent Searches
                      </div>
                      <div className="px-2 space-y-0.5">
                        {filteredResults.recent.map((item, i) => (
                          <ResultItem 
                            key={item.id} 
                            item={item} 
                            active={selectedIndex === i}
                            onClick={() => {
                              addRecentSearch(item)
                              if (item.href) router.push(item.href)
                              closeSearch()
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="px-4 mb-2 flex items-center gap-2 text-[11px] font-bold text-[#444444] uppercase tracking-wider">
                      <Zap className="w-3 h-3" /> Suggestions
                    </div>
                    <div className="px-2 space-y-0.5">
                      {filteredResults.suggestions?.map((item, i) => (
                        <ResultItem 
                          key={item.id} 
                          item={item} 
                          active={selectedIndex === (filteredResults.recent?.length || 0) + i}
                          onClick={() => {
                            if (item.type !== 'command') addRecentSearch(item)
                            if (item.href) router.push(item.href)
                            closeSearch()
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-2">
                  {filteredResults.results?.length ? (
                    filteredResults.results.map((item, i) => (
                      <ResultItem 
                        key={item.id} 
                        item={item} 
                        active={selectedIndex === i}
                        onClick={() => {
                          addRecentSearch(item)
                          if (item.href) router.push(item.href)
                          closeSearch()
                        }}
                      />
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-[#444444] pt-12">
                      <Search className="w-12 h-12 mb-4 opacity-20" />
                      <p>No results found for &quot;{query}&quot;</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar (Quick Actions) */}
          <div className="w-[350px] bg-white/[0.02] p-6 border-l border-white/5">
            <div className="text-[11px] font-bold text-[#444444] uppercase tracking-[0.1em] mb-6 flex items-center gap-2 px-2">
              <Zap className="w-3.5 h-3.5" /> Quick actions
            </div>
            <div className="space-y-1">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    closeSearch()
                    useUIStore.getState().openCreate(action.type)
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-[#999999] hover:bg-[#1A1A1A] hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="w-4 h-4 text-[#444444] group-hover:text-white transition-colors" />
                    <span>{action.label}</span>
                  </div>
                  <div className="w-5 h-5 flex items-center justify-center bg-[#141414] border border-[#262626] rounded text-[10px] font-mono text-[#444444]">
                    {action.shortcut}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ResultItem({ item, active, onClick }: { item: SearchResult, active: boolean, onClick: () => void }) {
  const Icon = item.icon
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
        active ? "bg-white/[0.08]" : "hover:bg-white/[0.03] active:bg-white/[0.05]"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn("p-2 rounded-lg border border-white/5 group-hover:border-white/10 transition-colors", item.bgColor || "bg-[#141414]", item.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">{item.title}</div>
          <div className="text-xs text-[#666666]">{item.metadata}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {item.time && <div className="text-xs text-[#444444]">{item.time}</div>}
        <ArrowRight className={cn("w-4 h-4 text-[#444444] transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
      </div>
    </div>
  )
}
