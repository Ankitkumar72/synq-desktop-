"use client"

import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Clock, FileText, ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import dynamic from "next/dynamic"

const NoteEditor = dynamic(
  () => import("@/components/notes/editor").then((mod) => mod.NoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col gap-4 animate-pulse">
        <div className="h-6 w-3/4 bg-neutral-800/50 rounded-md" />
        <div className="h-4 w-full bg-neutral-800/50 rounded-md" />
        <div className="h-4 w-5/6 bg-neutral-800/50 rounded-md" />
        <div className="h-4 w-4/6 bg-neutral-800/50 rounded-md" />
      </div>
    ),
  }
)

import { SyncStatusIndicator } from "@/components/notes/sync-status-indicator"
import { ActivePresenceAvatars } from "@/components/notes/active-presence"
import { AnimatePage } from "@/components/layout/animate-page"
import { useNotesStore } from "@/shared"
import { useUIStore } from "@/shared"
import { useProjectStore } from "@/shared"
import { Note } from "@/shared"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { formatRelativeDate } from "@/lib/utils/date-utils"
import { useDebounce } from "@/hooks/use-debounce"
import { NoteContextMenu } from "@/components/notes/note-context-menu"
import { cloneNoteContent, createEmptyNoteContent } from "@/shared"


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
          "group w-full p-1 min-h-[27px] flex items-center gap-3 transition-all duration-200 rounded-lg select-none text-left",
          isSelected
            ? "bg-white/10 text-white"
            : "text-[#A3A3A3] hover:bg-white/5 hover:text-white"
        )}
      >
        <div className="flex items-center justify-center shrink-0">
          <FileText className={cn(
            "w-[18px] h-[18px] transition-colors",
            isSelected ? "text-white" : "text-[#A3A3A3] group-hover:text-white"
          )} strokeWidth={2} />
        </div>
        <span className={cn(
          "text-[14px] truncate flex-1 tracking-tight font-semibold",
          isSelected ? "text-white" : "text-[#A3A3A3] group-hover:text-white"
        )}>
          {note.title || "Untitled Note"}
        </span>
      </button>
    </NoteContextMenu>
  )
}


function NotesPageContent() {
  const hasHydrated = useNotesStore(s => s._hasHydrated);
  const notes = useNotesStore(s => s.notes); const selectedNoteId = useNotesStore(s => s.selectedNoteId); const setSelectedNoteId = useNotesStore(s => s.setSelectedNoteId); const addNote = useNotesStore(s => s.addNote); const updateNote = useNotesStore(s => s.updateNote); const deleteNote = useNotesStore(s => s.deleteNote); const pinNote = useNotesStore(s => s.pinNote); const updateNoteLocal = useNotesStore(s => s.updateNoteLocal)
  const projects = useProjectStore(s => s.projects); const fetchProjects = useProjectStore(s => s.fetchProjects)
  const isSidebarOpen = useUIStore(s => s.isSidebarOpen)
  const searchParams = useSearchParams()
  const urlNoteId = searchParams.get("id")


  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
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
        const noteExists = notes.some(n => n.id === currentUrlId && !n.is_deleted && !n.deleted_at && !n.is_task)
        if (noteExists) {
          setSelectedNoteId(currentUrlId)
          lastUrlId.current = currentUrlId
          hasSyncedFromUrl.current = true
        } else {
          // If the URL note doesn't exist or is deleted, clear it from URL
          const url = new URL(window.location.href)
          url.searchParams.delete('id')
          window.history.replaceState(null, '', url.toString())
          lastUrlId.current = null
          hasSyncedFromUrl.current = true
        }
      }
    } else if (!currentUrlId && !hasSyncedFromUrl.current && notes.length > 0) {
      hasSyncedFromUrl.current = true
    }
  }, [searchParams, notes, selectedNoteId, setSelectedNoteId])

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects()
    }
  }, [projects.length, fetchProjects])

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

  const debouncedUpdate = useDebounce(updateNote, 800)

  const filteredNotes = useMemo(() => {
    return notes
      .filter(note => !note.deleted_at && !note.is_task)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [notes])

  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.pinned), [filteredNotes])
  const globalNotes = useMemo(() => {
    const folderIds = new Set(projects.map(p => p.id))
    return filteredNotes.filter(n => {
      if (n.folder_id && folderIds.has(n.folder_id)) return false
      if (n.category && folderIds.has(n.category)) return false
      return true
    })
  }, [filteredNotes, projects])

  const selectedNote = useMemo(() => {
    return notes.find(n => n.id === selectedNoteId)
  }, [notes, selectedNoteId])

  useEffect(() => {
    if (selectedNote?.is_deleted || selectedNote?.deleted_at) {
      setSelectedNoteId(null)
    }
  }, [selectedNote?.is_deleted, selectedNote?.deleted_at, setSelectedNoteId])

  const handleAddNote = async () => {
    const newId = await addNote({
      title: "",
      content: createEmptyNoteContent(),
      body: null,
      excerpt: null,
      tags: [],
      pinned: false
    })
    if (newId) setSelectedNoteId(newId)
  }

  const handleAddGlobalNote = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedSections(s => ({ ...s, all: true }))
    await handleAddNote()
  }

  const handleAddFolderNote = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation()
    setExpandedSections(s => ({ ...s, [`folder-${folderId}`]: true }))

    const newId = await addNote({
      title: "",
      content: createEmptyNoteContent(),
      body: null,
      excerpt: null,
      tags: [],
      pinned: false,
      category: folderId,
      folder_id: undefined
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

  if (!hasHydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-neutral-400 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <AnimatePage className="h-full">
      <div className="flex h-full bg-transparent text-neutral-300 font-sans selection:bg-neutral-700">
        {/* Sidebar */}
        <div className={cn(
          "flex flex-col bg-white/[0.025] border-r border-[#2E2E2E] transition-all duration-200 ease-out overflow-hidden shrink-0 font-notion",
          isSidebarOpen ? "w-64" : "w-0 border-r-0"
        )}>
          <ScrollArea className="flex-1">
            <div className="flex flex-col px-2 pt-4 pb-6">
              {/* Pinned Section */}
              {pinnedNotes.length > 0 && (
                <div className="flex flex-col">
                  <button
                    onClick={() => setExpandedSections(s => ({ ...s, pinned: !s.pinned }))}
                    className="w-full flex items-center justify-between px-3.5 py-0.5 min-h-[27px] bg-transparent hover:bg-white/5 transition-colors rounded-lg group"
                  >
                    <div className="flex items-center gap-1.5 text-[#9B9B9B] font-medium text-[12px] leading-none">
                      Pinned
                      <ChevronDown className={cn("w-[14px] h-[14px] text-[#A3A3A3] transition-all duration-200 opacity-0 group-hover:opacity-100", !expandedSections.pinned && "-rotate-90")} strokeWidth={2} />
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {expandedSections.pinned && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0, transition: { opacity: { duration: 0.1 } } }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col pt-[9px] gap-[2px]">
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
              <div className="flex flex-col mt-[9px]">
                <button
                  onClick={() => setExpandedSections(s => ({ ...s, all: !s.all }))}
                  className="w-full flex items-center justify-between px-3.5 py-0.5 min-h-[27px] bg-transparent hover:bg-white/5 transition-colors rounded-lg group"
                >
                  <div className="flex items-center gap-1.5 text-[#9B9B9B] font-medium text-[12px] leading-none">
                    All Notes
                    <ChevronDown className={cn("w-[14px] h-[14px] text-[#A3A3A3] transition-all duration-200 opacity-0 group-hover:opacity-100", !expandedSections.all && "-rotate-90")} strokeWidth={2} />
                  </div>
                  <div className="flex items-center gap-1 text-[#A3A3A3] opacity-0 group-hover:opacity-100 transition-opacity">
                    <div onClick={(e) => { e.stopPropagation(); handleAddGlobalNote(e); }} className="hover:text-white transition-colors">
                      <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
                    </div>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {expandedSections.all && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0, transition: { opacity: { duration: 0.1 } } }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col pt-[9px] gap-[2px]">
                        {globalNotes.length === 0 ? (
                          <div className="flex items-center gap-1.5 px-3 py-1">
                            <div className="w-3 h-3 shrink-0" />
                            <p className="text-[13px] text-stone-600 italic">No notes</p>
                          </div>
                        ) : (
                          globalNotes.map((note) => (
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

              {/* Individual Folders (As Sections) */}
              {projects.length > 0 && projects.map(folder => {
                const folderNotes = filteredNotes.filter(n => n.folder_id === folder.id || n.category === folder.id)
                const isExpanded = expandedSections[`folder-${folder.id}`] !== false; // default true
                
                return (
                  <div key={folder.id} className="flex flex-col mt-[9px]">
                    <button
                      onClick={() => setExpandedSections(s => ({ ...s, [`folder-${folder.id}`]: !isExpanded }))}
                      className="w-full flex items-center justify-between px-3.5 py-0.5 min-h-[27px] bg-transparent hover:bg-white/5 transition-colors rounded-lg group"
                    >
                      <div className="flex items-center gap-1.5 text-[#9B9B9B] font-medium text-[12px] leading-none truncate">
                        <span className="truncate">{folder.name}</span>
                        <ChevronDown className={cn("w-[14px] h-[14px] text-[#A3A3A3] transition-all duration-200 opacity-0 group-hover:opacity-100 shrink-0", !isExpanded && "-rotate-90")} strokeWidth={2} />
                      </div>
                      <div className="flex items-center gap-1 text-[#A3A3A3] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <div onClick={(e) => { e.stopPropagation(); handleAddFolderNote(e, folder.id); }} className="hover:text-white transition-colors">
                          <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
                        </div>
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0, transition: { opacity: { duration: 0.1 } } }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col pt-[9px] gap-[2px]">
                            {folderNotes.length === 0 ? (
                              <div className="flex items-center gap-1.5 px-3.5 py-1">
                                <div className="w-3 h-3 shrink-0" />
                                <div className="text-[13px] text-stone-600 italic">Empty</div>
                              </div>
                            ) : (
                              folderNotes.map((note) => (
                                <NoteSidebarItem
                                  key={`folder-${folder.id}-${note.id}`}
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
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col bg-transparent overflow-hidden min-h-0">
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
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Clean Header */}
              <header className="h-12 border-b border-neutral-800/50 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-neutral-500 font-medium truncate max-w-[300px]">
                    {selectedNote.title || "Untitled Note"}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <ActivePresenceAvatars noteId={selectedNote.id} />
                  <SyncStatusIndicator />
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeDate(selectedNote.updated_at)}</span>
                  </div>
                </div>
              </header>

              {/* Editor Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                <div className="max-w-3xl mx-auto w-full px-8 md:px-12 pt-10 pb-32">
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => {
                      updateNoteLocal(selectedNote.id, { title: e.target.value })
                      debouncedUpdate(selectedNote.id, { title: e.target.value })
                    }}
                    className="w-full text-[32px] font-bold tracking-tight border-none bg-transparent focus-visible:outline-none mb-6 placeholder:text-neutral-800 text-neutral-100 selection:bg-neutral-700 leading-tight"
                    placeholder="Untitled Note"
                  />

                  <NoteEditor
                    key={selectedNote.id}
                    id={selectedNote.id}
                    content={selectedNote.content}
                    onChange={(snapshot) => {
                      // Only update local state. Persistence is handled by the editor's saveYDocToSupabase.
                      updateNoteLocal(selectedNote.id, {
                        content: snapshot.content,
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
