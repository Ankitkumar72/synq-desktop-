"use client"

import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Clock, Search, FileText, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NoteEditor } from "@/components/notes/editor"
import { SyncStatusIndicator } from "@/components/notes/sync-status-indicator"
import { AnimatePage } from "@/components/layout/animate-page"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useUIStore } from "@/lib/store/use-ui-store"
import { Note } from "@/types"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { formatRelativeDate } from "@/lib/utils/date-utils"
import { useDebounce } from "@/hooks/use-debounce"
import { NoteContextMenu } from "@/components/notes/note-context-menu"
import { cloneNoteContent, createEmptyNoteContent } from "@/lib/notes/note-content"


function NoteSidebarItem({
  note,
  isSelected,
  onClick,
  onAction
}: {
  note: Note,
  isSelected: boolean,
  onClick: () => void,
  onAction: (action: string, noteId: string) => void
}) {
  return (
    <NoteContextMenu note={note} onAction={onAction}>
      <button
        onClick={onClick}
        className={cn(
          "group w-full px-3 py-1.5 flex items-center gap-2 transition-all duration-200 rounded-md select-none text-left",
          isSelected
            ? "bg-neutral-800/80 text-white"
            : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
        )}
      >
        <div className="flex items-center justify-center shrink-0 w-7">
          <FileText className={cn(
            "w-4 h-4 transition-colors",
            isSelected ? "text-neutral-200" : "text-neutral-500 group-hover:text-neutral-400"
          )} />
        </div>
        <span className={cn(
          "text-[13px] truncate flex-1 tracking-tight font-medium",
          isSelected ? "text-white" : "text-neutral-300 group-hover:text-neutral-200"
        )}>
          {note.title || "Untitled"}
        </span>
      </button>
    </NoteContextMenu>
  )
}


function NotesPageContent() {
  const { notes, selectedNoteId, setSelectedNoteId, addNote, updateNote, deleteNote, pinNote, updateNoteLocal } = useNotesStore()
  const { isSidebarOpen } = useUIStore()
  const searchParams = useSearchParams()
  const urlNoteId = searchParams.get("id")
  
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedSections, setExpandedSections] = useState({
    pinned: true,
    all: true
  })

  const isInitialMount = useRef(true)
  const lastUrlId = useRef<string | null>(urlNoteId)
  const hasSyncedFromUrl = useRef(false)

  // Sync state from URL on mount or when URL changes (e.g. external navigation or back button)
  useEffect(() => {
    const currentUrlId = searchParams.get("id")
    if (currentUrlId && currentUrlId !== selectedNoteId) {
      if (!hasSyncedFromUrl.current || currentUrlId !== lastUrlId.current) {
        const noteExists = notes.some(n => n.id === currentUrlId)
        if (noteExists) {
          setSelectedNoteId(currentUrlId)
          lastUrlId.current = currentUrlId
          hasSyncedFromUrl.current = true
        }
      }
    } else if (!currentUrlId && !hasSyncedFromUrl.current && notes.length > 0) {
      hasSyncedFromUrl.current = true
    }
  }, [searchParams, notes, selectedNoteId, setSelectedNoteId])

  // Sync URL with selectedNoteId using silent history updates
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const currentUrlId = new URL(window.location.href).searchParams.get('id')
    
    if (selectedNoteId) {
      if (selectedNoteId !== currentUrlId) {
        const url = new URL(window.location.href)
        url.searchParams.set('id', selectedNoteId)
        window.history.replaceState(null, '', url.toString())
        lastUrlId.current = selectedNoteId
      }
    } else if (currentUrlId) {
      const url = new URL(window.location.href)
      url.searchParams.delete('id')
      window.history.replaceState(null, '', url.toString())
      lastUrlId.current = null
    }
  }, [selectedNoteId])

  const debouncedUpdate = useDebounce(updateNote, 250)

  const filteredNotes = useMemo(() => {
    return notes
      .filter(note => !note.deleted_at)
      .filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [notes, searchQuery])

  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.pinned), [filteredNotes])

  const selectedNote = useMemo(() => {
    return notes.find(n => n.id === selectedNoteId)
  }, [notes, selectedNoteId])

  useEffect(() => {
    if (selectedNote?.is_deleted) {
      setSelectedNoteId(null)
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
        setSelectedNoteId(noteId)
        break
      default:
    }
  }



  return (
    <AnimatePage className="h-full">
      <div className="flex h-full bg-neutral-950 text-neutral-300 font-sans selection:bg-neutral-700">
        {/* Sidebar */}
        <div className={cn(
          "flex flex-col bg-neutral-950 border-r border-neutral-800/50 transition-all duration-200 ease-out overflow-hidden shrink-0",
          isSidebarOpen ? "w-64" : "w-0 border-r-0"
        )}>
          {/* Sidebar Header */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                Notes
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddNote}
                className="h-6 w-6 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/80 rounded-md transition-all"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-[13px] bg-neutral-900/40 border-none focus:ring-1 focus:ring-neutral-800 focus:outline-none focus:bg-neutral-900/60 placeholder:text-neutral-700 transition-all rounded-lg text-neutral-300"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col px-2 pb-6 gap-2">
              {/* Pinned Section */}
              {pinnedNotes.length > 0 && (
                <div className="flex flex-col">
                  <button
                    onClick={() => setExpandedSections(s => ({ ...s, pinned: !s.pinned }))}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-neutral-500 hover:text-neutral-300 transition-colors w-full text-left group mt-4 mb-1"
                  >
                    <ChevronRight className={cn(
                      "w-3 h-3 transition-transform duration-200 shrink-0",
                      expandedSections.pinned && "rotate-90"
                    )} />
                    Pinned
                  </button>
                  <AnimatePresence initial={false}>
                    {expandedSections.pinned && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {pinnedNotes.map((note) => (
                            <NoteSidebarItem
                              key={`pinned-${note.id}`}
                              note={note}
                              isSelected={selectedNoteId === note.id}
                              onClick={() => setSelectedNoteId(note.id)}
                              onAction={handleNoteAction}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* All Notes Section */}
              <div className="flex flex-col">
                <button
                  onClick={() => setExpandedSections(s => ({ ...s, all: !s.all }))}
                  className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-neutral-500 hover:text-neutral-300 transition-colors w-full text-left group mt-4 mb-1"
                >
                  <ChevronRight className={cn(
                    "w-3 h-3 transition-transform duration-200 shrink-0",
                    expandedSections.all && "rotate-90"
                  )} />
                  All Notes
                </button>
                <AnimatePresence initial={false}>
                  {expandedSections.all && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {filteredNotes.length === 0 ? (
                          <p className="px-6 py-2 text-[12px] text-neutral-600 italic">No notes found</p>
                        ) : (
                          filteredNotes.map((note) => (
                            <NoteSidebarItem
                              key={`all-${note.id}`}
                              note={note}
                              isSelected={selectedNoteId === note.id}
                              onClick={() => setSelectedNoteId(note.id)}
                              onAction={handleNoteAction}
                            />
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
          {!selectedNote ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-neutral-700" />
              </div>
              <h2 className="text-base font-medium text-neutral-500 mb-1">Select a note</h2>
              <p className="text-[13px] text-neutral-600 max-w-sm">
                Choose a note from the sidebar or create a new one to start writing.
              </p>
              <Button
                onClick={handleAddNote}
                variant="outline"
                className="mt-6 bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 h-8 text-[13px] px-4"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Note
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Clean Header */}
              <header className="h-12 border-b border-neutral-800/50 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-neutral-500 font-medium truncate max-w-[300px]">
                    {selectedNote.title || "Untitled"}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <SyncStatusIndicator />
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeDate(selectedNote.updated_at)}</span>
                  </div>
                </div>
              </header>

              {/* Editor Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="max-w-3xl mx-auto w-full px-8 md:px-12 pt-10 pb-32">
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => {
                      updateNoteLocal(selectedNote.id, { title: e.target.value })
                      debouncedUpdate(selectedNote.id, { title: e.target.value })
                    }}
                    className="w-full text-[32px] font-bold tracking-tight border-none bg-transparent focus-visible:outline-none mb-6 placeholder:text-neutral-800 text-neutral-100 selection:bg-neutral-700 leading-tight"
                    placeholder="Untitled"
                  />

                  <NoteEditor
                    key={selectedNote.id}
                    id={selectedNote.id}
                    content={selectedNote.content}
                    onChange={(snapshot) => {
                      // Only update local state. Persistence is handled by the editor's saveYDocToSupabase.
                      updateNoteLocal(selectedNote.id, {
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

export default function NotesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-neutral-800 border-t-neutral-400 rounded-full animate-spin" />
          <p className="text-sm text-neutral-500 font-medium">Loading notes...</p>
        </div>
      </div>
    }>
      <NotesPageContent />
    </Suspense>
  )
}