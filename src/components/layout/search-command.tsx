"use client"

import * as React from "react"
import { Search, CheckCircle, FileText, Folder } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useUIStore, SearchResult } from "@/lib/store/use-ui-store"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { useFolderStore } from "@/lib/store/use-folder-store"
import { useRouter } from "next/navigation"
import { Calendar as CalendarIcon } from "lucide-react"

type FilterType = "all" | "tasks" | "docs" | "events" | "folders" | "people" | "commands"

export function SearchCommand() {
  const { isSearchOpen, closeSearch, recentSearches, addRecentSearch } = useUIStore()
  const [query, setQuery] = React.useState("")
  const [activeFilter, setActiveFilter] = React.useState<FilterType>("all")
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const router = useRouter()

  const tasks = useTaskStore((state) => state.tasks)
  const notes = useNotesStore((state) => state.notes)
  const events = useEventStore((state) => state.events)
  const folders = useFolderStore((state) => state.folders)

  // Derived search results
  const filteredResults = React.useMemo<{
    recent?: SearchResult[]
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
        if (item.type === 'event') return events.find(e => e.id === item.id && !e.is_deleted)
        if (item.type === 'folder') return folders.find(f => f.id === item.id && !f.is_deleted)
        return true
      })
      return {
        recent: validHistory
      }
    }

    // Filter logic
    if (activeFilter === "all" || activeFilter === "tasks") {
      (tasks || []).filter(t =>
        ((t.title && t.title.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))) &&
        !t.is_deleted
      ).forEach(t => {
        results.push({ id: t.id, type: 'task', title: t.title || 'Untitled', metadata: 'Task', icon: CheckCircle, href: `/tasks/${t.id}` })
      })
    }
    if (activeFilter === "all" || activeFilter === "docs") {
      (notes || []).filter(n =>
        ((n.title && n.title.toLowerCase().includes(q)) ||
          (n.body && n.body.toLowerCase().includes(q))) &&
        !n.is_deleted
      ).forEach(n => {
        results.push({ id: n.id, type: 'doc', title: n.title || 'Untitled', metadata: 'Note', icon: FileText, href: `/notes/${n.id}` })
      })
    }
    if (activeFilter === "all" || activeFilter === "events") {
      (events || []).filter(e =>
        ((e.title && e.title.toLowerCase().includes(q)) ||
          (e.description && e.description.toLowerCase().includes(q))) &&
        !e.is_deleted
      ).forEach(e => {
        results.push({ id: e.id, type: 'event', title: e.title || 'Untitled', metadata: 'Event', icon: CalendarIcon, href: `/calendar` })
      })
    }
    if (activeFilter === "all" || activeFilter === "folders") {
      (folders || []).filter(f => f.name && f.name.toLowerCase().includes(q) && !f.is_deleted).forEach(f => {
        results.push({ id: f.id, type: 'folder', title: f.name || 'Untitled', metadata: 'Folder', icon: Folder, href: `/notes` })
      })
    }

    return { results }
  }, [query, activeFilter, tasks, notes, events, folders, recentSearches])

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
        const q = query.toLowerCase()
        const total = !q 
          ? (filteredResults.recent?.length || 0)
          : (filteredResults.results?.length || 0)
        setSelectedIndex((prev) => Math.min(total - 1, prev + 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const q = query.toLowerCase()
        let item: SearchResult | undefined = undefined

        if (!q) {
          item = filteredResults.recent?.[selectedIndex]
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
    { id: "docs", label: "Notes" },
    { id: "events", label: "Events" },
    { id: "tasks", label: "Tasks" },
    { id: "folders", label: "Folders" },
  ]

  return (
    <Dialog open={isSearchOpen} onOpenChange={(open) => !open && closeSearch()}>
      <DialogContent
        showCloseButton={false}
        className="!p-0 !gap-0 !border-none !bg-transparent !shadow-none !ring-0 !max-w-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999]"
        style={{ width: '750px', maxWidth: '95vw' }}
      >
        <div className="flex flex-col h-[450px] w-full overflow-hidden bg-[#1E1E1E] border border-white/10 rounded-xl shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center px-4 py-4 gap-3 border-b border-white/5">
            <Search className="w-5 h-5 text-[#888]" />
            <input
              autoFocus
              placeholder="Search..."
              className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder-[#666] font-normal"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center px-2 py-2 gap-1 border-b border-white/5 overflow-x-auto no-scrollbar">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap",
                  activeFilter === filter.id
                    ? "bg-white/10 text-white"
                    : "text-[#888] hover:bg-white/5 hover:text-white"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2">
            {query === "" && activeFilter === "all" ? (
              <>
                {filteredResults.recent && filteredResults.recent.length > 0 && (
                  <div className="mb-4">
                    <div className="px-3 mb-1.5 text-xs font-medium text-[#666] uppercase tracking-wider">
                      Recent
                    </div>
                    <div className="space-y-0.5">
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
              </>
            ) : (
              <div className="py-1">
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
                ) : null}
              </div>
            )}
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
        "flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
        active ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("w-4 h-4", active ? "text-white" : "text-[#888]")} />
        <div>
          <div className="text-sm text-white font-medium">{item.title}</div>
        </div>
      </div>
      <div className="text-xs text-[#666]">{item.metadata}</div>
    </div>
  )
}
