"use client"

import { useState, useMemo, useEffect } from "react";
import { Plus, Clock, Search, Trash2, LayoutGrid, Star, Archive } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { ScrollArea } from "@/components/ui/scroll-area"
import { NoteEditor } from "@/components/notes/editor"
import { SyncStatusIndicator } from "@/components/notes/sync-status-indicator"
import { AnimatePage } from "@/components/layout/animate-page"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useUIStore } from "@/lib/store/use-ui-store"
import { formatRelativeDate } from "@/lib/utils/date-utils"
import { useDebounce } from "@/hooks/use-debounce"
import { NoteContextMenu } from "@/components/notes/note-context-menu"
import { cloneNoteContent, createEmptyNoteContent } from "@/lib/notes/note-content"


export default function NotesPage() {
  const { notes, selectedNoteId, setSelectedNoteId, addNote, updateNote, deleteNote, pinNote, updateNoteLocal } = useNotesStore()
  const { isSidebarOpen } = useUIStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "pinned" | "trash">("all")

  const debouncedUpdate = useDebounce(updateNote, 250)

  const filteredNotes = useMemo(() => {
    const result = notes
      .filter(note => {
        if (filter === "trash") return !!note.deleted_at
        if (filter === "pinned") return !note.deleted_at && note.pinned
        return !note.deleted_at
      })
      .filter(note => !note.is_task) // Exclude tasks from notes view
      .filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        note.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // Pinned notes first (only if in "all" view)
        if (filter === "all") {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
        }
        // Then by date
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
    return result
  }, [notes, searchQuery, filter])

  const selectedNote = useMemo(() => {
    return notes.find(n => n.id === selectedNoteId)
  }, [notes, selectedNoteId])

  // Handle remote deletion
  useEffect(() => {
    if (selectedNote?.is_deleted) {
      // If the note was deleted on another device, deselect it
      setSelectedNoteId(null)
      // Note: Toast could be added here if a toast system exists
    }
  }, [selectedNote?.is_deleted, setSelectedNoteId])

  const handleAddNote = async () => {
    const newId = await addNote({
      title: "Untitled Note",
      content: createEmptyNoteContent(),
      body: null,
      excerpt: null,
      tags: [],
      pinned: false
    })
    if (newId) setSelectedNoteId(newId)
  }

  const handleNoteAction = async (action: string, noteId: string) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return

    switch (action) {
      case "pin":
        pinNote(noteId, !note.pinned)
        break
      case "delete":
        deleteNote(noteId)
        break
      case "duplicate":
        const newId = await addNote({
          title: `${note.title} (Copy)`,
          content: cloneNoteContent(note.content ?? null),
          excerpt: note.excerpt,
          body: note.body,
          tags: note.tags,
          pinned: false
        })
        if (newId) setSelectedNoteId(newId)
        break
      case "copy":
        navigator.clipboard.writeText(`${window.location.origin}/notes?id=${noteId}`)
        break
      case "open-new":
        window.open(`/notes?id=${noteId}`, '_blank')
        break
      case "rename":
        // For production, we could show a modal or just select the note and focus title
        setSelectedNoteId(noteId)
        // Focus logic would go here if we had a ref to the title input
        break
      default:
    }
  }

  return (
    <AnimatePage className="h-full">
      <div className="flex h-full bg-[#09090B] text-[#E1E2E4] font-sans selection:bg-[#4B7BFF]/30">
        {/* Sidebar Organization Area */}
        <div className={cn(
          "flex flex-col bg-[#09090B] border-r border-white/[0.04] transition-all duration-300 ease-in-out overflow-hidden shrink-0",
          isSidebarOpen ? "w-[280px]" : "w-0 border-r-0"
        )}>
          {/* Sidebar Header */}
          <div className="px-4 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-[11px] font-bold text-white/20 uppercase tracking-[0.1em] flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                Workspace
              </h1>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleAddNote}
                className="h-6 w-6 text-white/30 hover:text-white/80 hover:bg-white/[0.04] rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Search Input */}
            <div className="relative group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 group-focus-within:text-blue-400/80 transition-colors" />
              <input 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-8 pr-3 text-[12px] bg-white/[0.02] border border-white/[0.04] focus:border-white/[0.08] focus:outline-none placeholder:text-white/10 transition-all rounded-[4px] text-white/80"
              />
            </div>
          </div>

          {/* Nav Sections */}
          <div className="px-2 space-y-0.5">
            {[
              { id: "all", label: "All Notes", icon: LayoutGrid },
              { id: "pinned", label: "Pinned", icon: Star },
              { id: "trash", label: "Trash", icon: Trash2 },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id as "all" | "pinned" | "trash")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[12px] rounded-md transition-colors",
                  filter === item.id 
                    ? "bg-white/[0.06] text-white/90 font-medium shadow-sm" 
                    : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                )}
              >
                <item.icon className={cn(
                  "w-3.5 h-3.5 opacity-80",
                  filter === item.id ? "text-blue-400/90" : "text-inherit"
                )} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-8 px-4 mb-2">
            <h2 className="text-[10px] font-bold text-white/10 uppercase tracking-[0.15em] px-1">
              {filter === 'all' ? 'Recent' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </h2>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col px-2 pb-8">
              {filteredNotes.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-[11px] font-medium text-white/20">No notes here</p>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <NoteContextMenu 
                    key={note.id} 
                    note={note} 
                    onAction={handleNoteAction}
                  >
                    <div 
                      className={cn(
                        "group px-3 py-2.5 cursor-pointer transition-all duration-200 rounded-md mb-0.5 relative flex flex-col gap-1.5 border border-transparent select-none",
                        selectedNoteId === note.id 
                          ? "bg-white/[0.06] text-white/90 border-white/[0.04] active-note-glow shadow-[0_4px_12px_rgba(0,0,0,0.1)]" 
                          : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                      )}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "text-[13px] font-semibold truncate flex-1 transition-colors",
                          selectedNoteId === note.id ? "text-white/90" : "text-white/50 group-hover:text-white/80"
                        )}>
                          {note.title || "Untitled"}
                        </span>
                        {note.pinned && <Star className="w-2.5 h-2.5 text-blue-400 fill-blue-400/20 shrink-0" />}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "text-[11px] truncate leading-tight transition-colors line-clamp-1",
                          selectedNoteId === note.id ? "text-white/40" : "text-white/20 group-hover:text-white/30"
                        )}>
                          {note.excerpt || "No content"}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 opacity-40 group-hover:opacity-60 transition-opacity">
                          <Clock className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                            {formatRelativeDate(note.updated_at)}
                          </span>
                        </div>
                      </div>
                      {selectedNoteId === note.id && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                      )}
                    </div>
                  </NoteContextMenu>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Editor Main Area */}
        <div className="flex-1 flex flex-col bg-[#09090B] overflow-hidden">
          {!selectedNote ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-6">
                <LayoutGrid className="w-8 h-8 text-white/10" />
              </div>
              <h2 className="text-lg font-medium text-white/40 mb-2">Select a note to view</h2>
              <p className="text-sm text-white/20 max-w-xs mx-auto">Choose a note from the sidebar or create a new one to get started.</p>
              <Button 
                onClick={handleAddNote}
                variant="outline"
                className="mt-8 bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] text-white/60 hover:text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Note
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Header / Toolbar Area */}
              <header className="h-14 border-b border-white/[0.04] flex items-center justify-between px-8 glass-header z-30 select-none">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 text-[11px] font-semibold tracking-tight">
                    <div className="flex items-center gap-1.5 text-white/20 hover:text-white/40 transition-colors cursor-pointer">
                      <Archive className="w-3.5 h-3.5" />
                      <span>Library</span>
                    </div>
                    <span className="text-white/5 select-none">/</span>
                    <div className="flex items-center gap-1.5 text-white/20 hover:text-white/40 transition-colors cursor-pointer">
                      <span>Notes</span>
                    </div>
                    <span className="text-white/5 select-none">/</span>
                    <span className="text-white/80 truncate max-w-[240px] font-medium">{selectedNote.title || "Untitled"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <SyncStatusIndicator />
                  <div className="flex items-center gap-2 text-[10px] text-white/20 font-bold uppercase tracking-widest font-mono bg-white/[0.02] px-2.5 py-1 rounded-md border border-white/[0.03]">
                    <Clock className="w-3 h-3 opacity-60" />
                    <span>{formatRelativeDate(selectedNote.updated_at)}</span>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="max-w-3xl mx-auto w-full px-8 md:px-12 pt-20 pb-40">
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => {
                      updateNoteLocal(selectedNote.id, { title: e.target.value })
                      debouncedUpdate(selectedNote.id, { title: e.target.value })
                    }}
                    className="w-full text-4xl font-bold tracking-tight border-none bg-transparent focus-visible:outline-none mb-12 placeholder:text-white/5 text-white selection:bg-blue-500/30"
                    placeholder="Untitled"
                  />
                  
                  <NoteEditor 
                    key={selectedNote.id}
                    id={selectedNote.id}
                    content={selectedNote.content} 
                    onChange={(snapshot) => {
                      updateNote(selectedNote.id, { 
                        body: snapshot.body,
                        excerpt: snapshot.excerpt,
                      })
                    }} 
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatePage>
  )
}
