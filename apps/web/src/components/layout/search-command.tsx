"use client"

import * as React from "react"
import { Search, CheckCircle, FileText, Folder } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useUIStore, SearchResult } from "@synq/shared"
import { useTaskStore } from "@synq/shared"
import { useNotesStore } from "@synq/shared"
import { useEventStore } from "@synq/shared"
import { useFolderStore } from "@synq/shared"
import { useUserStore } from "@synq/shared"
import { useRouter } from "next/navigation"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"

type FilterType = "all" | "tasks" | "docs" | "events" | "folders" | "people" | "commands"

// Utility to strip markdown and basic HTML
function stripFormatting(text: string): string {
  if (!text) return ""
  return text
    .replace(/<[^>]*>?/gm, "") // Strip HTML
    .replace(/[#*`_~]/g, "") // Strip basic markdown
    .trim()
}

// Extract a snippet around the first matched token
function getSnippet(text: string, tokens: string[]): string {
  if (!text || tokens.length === 0) return ""
  const cleanText = stripFormatting(text)
  const lowerText = cleanText.toLowerCase()
  
  let firstMatchIdx = -1
  for (const token of tokens) {
    const idx = lowerText.indexOf(token)
    if (idx !== -1 && (firstMatchIdx === -1 || idx < firstMatchIdx)) {
      firstMatchIdx = idx
    }
  }

  if (firstMatchIdx === -1) {
    return cleanText.substring(0, 100) + (cleanText.length > 100 ? "..." : "")
  }

  const start = Math.max(0, firstMatchIdx - 40)
  const end = Math.min(cleanText.length, firstMatchIdx + 80)
  
  let snippet = cleanText.substring(start, end)
  if (start > 0) snippet = "..." + snippet
  if (end < cleanText.length) snippet = snippet + "..."
  return snippet
}


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
  const user = useUserStore((state) => state.user)
  
  const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Unknown User"

  // Derived search results
  const filteredResults = React.useMemo<{
    recent?: SearchResult[]
    results?: SearchResult[]
  }>(() => {
    const q = query.toLowerCase()
    const tokens = q.split(/\s+/).filter(Boolean)
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

    // Helper to format date
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return ""
      try {
        return format(new Date(dateStr), "MMM d, yyyy")
      } catch {
        return ""
      }
    }

    // Filter logic
    if (activeFilter === "all" || activeFilter === "tasks") {
      (tasks || []).filter(t =>
        (tokens.every(token => 
          (t.title && t.title.toLowerCase().includes(token)) ||
          (t.description && t.description.toLowerCase().includes(token))
        )) &&
        !t.is_deleted
      ).forEach(t => {
        results.push({ 
          id: t.id, type: 'task', title: t.title || 'Untitled', metadata: 'Task', icon: CheckCircle, href: `/tasks/${t.id}`,
          snippet: getSnippet(t.description || "", tokens),
          author: authorName,
          updatedAt: formatDate(t.updated_at)
        })
      })
    }
    if (activeFilter === "all" || activeFilter === "docs") {
      (notes || []).filter(n =>
        (tokens.every(token => 
          (n.title && n.title.toLowerCase().includes(token)) ||
          (n.body && n.body.toLowerCase().includes(token))
        )) &&
        !n.is_deleted
      ).forEach(n => {
        results.push({ 
          id: n.id, type: 'doc', title: n.title || 'Untitled', metadata: 'Note', icon: FileText, href: `/notes/${n.id}`,
          snippet: getSnippet(n.body || "", tokens),
          author: authorName,
          updatedAt: formatDate(n.updated_at)
        })
      })
    }
    if (activeFilter === "all" || activeFilter === "events") {
      (events || []).filter(e =>
        (tokens.every(token => 
          (e.title && e.title.toLowerCase().includes(token)) ||
          (e.description && e.description.toLowerCase().includes(token))
        )) &&
        !e.is_deleted
      ).forEach(e => {
        results.push({ 
          id: e.id, type: 'event', title: e.title || 'Untitled', metadata: 'Event', icon: CalendarIcon, href: `/calendar`,
          snippet: getSnippet(e.description || "", tokens),
          author: authorName,
          updatedAt: formatDate(e.start_date)
        })
      })
    }
    if (activeFilter === "all" || activeFilter === "folders") {
      (folders || []).filter(f => 
        tokens.every(token => f.name && f.name.toLowerCase().includes(token)) && !f.is_deleted
      ).forEach(f => {
        results.push({ 
          id: f.id, type: 'folder', title: f.name || 'Untitled', metadata: 'Folder', icon: Folder, href: `/notes`,
          snippet: "",
          author: authorName,
          updatedAt: formatDate(f.updated_at)
        })
      })
    }

    return { results }
  }, [query, activeFilter, tasks, notes, events, folders, recentSearches, authorName])

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
                          query={query}
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
                      query={query}
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

function HighlightedText({ text, query }: { text: string, query: string }) {
  if (!query || !text) return <>{text}</>

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return <>{text}</>

  // Escape special regex characters in tokens
  const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  
  // Create a regex that matches any of the tokens, case-insensitive
  const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi')
  
  const parts = text.split(regex)

  return (
    <span className="break-words">
      {parts.map((part, i) => {
        const isMatch = tokens.some(t => part.toLowerCase() === t)
        return isMatch ? (
          <span key={i} className="text-[#3b82f6] font-medium bg-[#3b82f6]/10 px-0.5 rounded">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </span>
  )
}

function ResultItem({ item, active, query, onClick }: { item: SearchResult, active: boolean, query?: string, onClick: () => void }) {
  const Icon = item.icon
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 px-3 py-3 rounded-lg cursor-pointer transition-colors",
        active ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={cn("w-4 h-4", active ? "text-white" : "text-[#888]")} />
          <div className="text-sm text-white font-medium">
            <HighlightedText text={item.title} query={query || ""} />
          </div>
        </div>
        <div className="text-xs text-[#666] font-medium px-2 py-0.5 rounded bg-white/5">{item.metadata}</div>
      </div>
      
      {(item.author || item.updatedAt) && (
        <div className="flex items-center gap-2 text-[11px] text-[#666] pl-7">
          {item.author && <span>{item.author}</span>}
          {item.author && item.updatedAt && <span>•</span>}
          {item.updatedAt && <span>Edited {item.updatedAt}</span>}
        </div>
      )}

      {item.snippet && (
        <div className="text-xs text-[#888] pl-7 mt-0.5 leading-relaxed line-clamp-2">
          <HighlightedText text={item.snippet} query={query || ""} />
        </div>
      )}
    </div>
  )
}
