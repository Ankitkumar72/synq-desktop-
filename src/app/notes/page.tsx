"use client"

import { useState, useMemo, useEffect } from "react";
import { Plus, Clock, Pin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NoteEditor } from "@/components/notes/editor"
import { AnimatePage } from "@/components/layout/animate-page"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useUIStore } from "@/lib/store/use-ui-store"
import { formatRelativeDate } from "@/lib/utils/date-utils"
import { useDebounce } from "@/hooks/use-debounce"
import { NoteContextMenu } from "@/components/notes/note-context-menu"

export default function NotesPage() {
  const { notes, selectedNoteId, setSelectedNoteId, addNote, updateNote, deleteNote, pinNote, updateNoteLocal } = useNotesStore()
  const { isSidebarOpen } = useUIStore()
  const [searchQuery, setSearchQuery] = useState("")

  const debouncedUpdate = useDebounce(updateNote, 400)

  const filteredNotes = useMemo(() => {
    const result = notes
      .filter(note => !note.deleted_at) // Exclude trashed notes
      .filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        note.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // Pinned notes first
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        // Then by date
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
    return result
  }, [notes, searchQuery])

  const selectedNote = useMemo(() => {
    return notes.find(n => n.id === selectedNoteId)
  }, [notes, selectedNoteId])

  // Handle remote deletion
  useEffect(() => {
    if (selectedNote?.is_deleted) {
      // If the note was deleted on another device, deselect it
      setSelectedNoteId(null)
      // Note: Toast could be added here if a toast system exists
      console.log('Note was deleted on another device')
    }
  }, [selectedNote?.is_deleted, setSelectedNoteId])

  const handleAddNote = async () => {
    console.log('adding note...'); const newId = await addNote({
      title: "Untitled Note",
      content: null,
      body: "Start writing...",
      excerpt: "Start writing...",
      tags: [],
      pinned: false
    })
    console.log('newId:', newId); if (newId) setSelectedNoteId(newId)
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
          content: note.content,
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
        console.log(`Action ${action} not implemented for note ${noteId}`)
    }
  }

  return (
    <AnimatePage>
      <div className="flex h-full bg-background text-foreground font-sans selection:bg-primary/20">
        {/* Sidebar Organization Area */}
        <div className="w-[260px] flex flex-col bg-background border-r border-border transition-all duration-300">
          <div className={cn(
            "p-6 space-y-5 transition-all duration-300",
            !isSidebarOpen && "pl-16"
          )}>
            <div className="flex items-center justify-center relative">
              <h1 className="text-xl font-semibold tracking-tight text-foreground text-center">Notes</h1>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddNote();
                  }}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-all duration-200 cursor-pointer pointer-events-auto"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>

          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col">
              {filteredNotes.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">No notes found</p>
                  <Button variant="link" size="sm" onClick={() => setSearchQuery("")} className="text-xs text-primary hover:text-primary/80">Clear search</Button>
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
                        "mx-2 px-3 py-2 cursor-pointer transition-all duration-300 group relative rounded-lg mb-0.5",
                        selectedNoteId === note.id 
                          ? "text-foreground bg-white/10 shadow-sm border border-white/5" 
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-[13.5px] font-medium truncate pr-4 leading-tight py-0.5">
                          {note.title || "Untitled"}
                        </h3>
                        {note.pinned && <Pin className="w-3 h-3 text-primary fill-primary/20 shrink-0 mt-1" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {formatRelativeDate(note.updated_at)}
                        </p>
                      </div>
                    </div>
                  </NoteContextMenu>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Editor Main Area - Production Workspace */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {!selectedNote ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-6 max-w-sm">
                <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto border border-border shadow-sm relative overflow-hidden group">
                  <Plus className="w-8 h-8 text-muted-foreground group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Capture thoughts</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">Organize your ideas and workflows in a high-precision workspace.</p>
                </div>
                <Button onClick={handleAddNote} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-8 h-12 text-sm font-medium shadow-lg shadow-primary/10 active:scale-95 transition-all duration-200">
                  New Note
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden relative group/editor">
              {/* Toolbar - Header Integrated */}


              <ScrollArea className="flex-1">
                <div className="max-w-4xl mx-auto w-full px-12 pt-12 pb-40">
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => {
                      updateNoteLocal(selectedNote.id, { title: e.target.value })
                      debouncedUpdate(selectedNote.id, { title: e.target.value })
                    }}
                    className="w-full text-4xl font-semibold tracking-tight border-none bg-transparent focus-visible:outline-none mb-3 placeholder:text-foreground/10 text-foreground display-hero text-center"
                    placeholder="Note Title"
                  />
                  <div className="flex items-center justify-center gap-4 text-muted-foreground text-[13px] mb-12 px-1">
                    <div className="flex items-center gap-2 hover:text-foreground transition-colors cursor-default group/stat">
                      <Clock className="w-4 h-4 group-hover:text-primary transition-colors" />
                      <span className="font-medium">Edited {formatRelativeDate(selectedNote.updated_at)}</span>
                    </div>

                  </div>
                  <NoteEditor 
                    id={selectedNote.id}
                    content={selectedNote.content} 
                    onChange={(val) => {
                      const plainText = val
                        .replace(/<[^>]*>/g, '') 
                        .replace(/[#*`_~\[\]()]/g, '') 
                        .trim()
                      
                      const updates = { 
                        content: val || null,
                        excerpt: plainText ? plainText.substring(0, 100) + (plainText.length > 100 ? '...' : '') : null,
                        body: plainText || null
                      }
                      
                      updateNoteLocal(selectedNote.id, updates)
                      updateNote(selectedNote.id, updates)
                    }} 
                  />
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </AnimatePage>
  )
}
