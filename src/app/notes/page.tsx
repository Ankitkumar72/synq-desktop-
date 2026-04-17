"use client"

import { useState, useMemo } from "react"
import { 
  Plus, 
  Search,
  Clock,
  Pin,
  MoreHorizontal,
  Trash2,
  Archive,
  Share2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { NoteEditor } from "@/components/notes/editor"
import { AnimatePage } from "@/components/layout/animate-page"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useUIStore } from "@/lib/store/use-ui-store"
import { formatRelativeDate } from "@/lib/utils/date-utils"
import { useDebounce } from "@/hooks/use-debounce"
import { NoteContextMenu } from "@/components/notes/note-context-menu"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"

export default function NotesPage() {
  const { notes, selectedNoteId, setSelectedNoteId, addNote, updateNote, deleteNote, pinNote, updateNoteLocal } = useNotesStore()
  const { isSidebarOpen } = useUIStore()
  const [searchQuery, setSearchQuery] = useState("")

  const debouncedUpdate = useDebounce(updateNote, 1000)

  const filteredNotes = useMemo(() => {
   const filteredNotes = notes
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
    return filteredNotes
  }, [notes, searchQuery])

  const selectedNote = useMemo(() => {
    return notes.find(n => n.id === selectedNoteId)
  }, [notes, selectedNoteId])

  const handleAddNote = async () => {
    const newId = await addNote({
      title: "Untitled Note",
      content: "",
      excerpt: "Start writing...",
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
          content: note.content,
          excerpt: note.excerpt,
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
      <div className="flex h-screen bg-[#09090B] text-[#E1E2E4] font-sans selection:bg-[#4B7BFF]/30">
        {/* Sidebar Organization Area */}
        <div className="w-[260px] flex flex-col bg-[#09090B] border-r border-white/5 transition-all duration-300">
          <div className={cn(
            "p-6 space-y-5 transition-all duration-300",
            !isSidebarOpen && "pl-16"
          )}>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold tracking-tight text-[#E1E2E4]">Notes</h1>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleAddNote}
                className="h-8 w-8 text-[#A1A3A7] hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A1A3A7]/20" />
              <Input 
                placeholder="Search notes..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 border-none bg-transparent text-[#E1E2E4] placeholder:text-[#A1A3A7]/10 text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col">
              {filteredNotes.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <p className="text-sm font-medium text-[#A1A3A7]">No notes found</p>
                  <Button variant="link" size="sm" onClick={() => setSearchQuery("")} className="text-xs text-[#4B7BFF] hover:text-[#3B6BEF]">Clear search</Button>
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
                        "px-6 py-2.5 cursor-pointer transition-all duration-200 group relative",
                        selectedNoteId === note.id 
                          ? "text-white" 
                          : "text-[#A1A3A7] hover:text-[#E1E2E4]"
                      )}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      {selectedNoteId === note.id && (
                        <div className="absolute left-0 top-1 bottom-1 w-[1.5px] bg-[#4B7BFF]" />
                      )}
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-[13.5px] font-medium truncate pr-4 leading-tight py-0.5">
                          {note.title || "Untitled"}
                        </h3>
                        {note.pinned && <Pin className="w-3 h-3 text-[#4B7BFF] fill-[#4B7BFF]/20 shrink-0 mt-1" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-[#A1A3A7] font-medium">
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
        <div className="flex-1 flex flex-col bg-[#09090B] overflow-hidden">
          {!selectedNote ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-6 max-w-sm">
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto border border-white/5 shadow-sm relative overflow-hidden group">
                  <Plus className="w-8 h-8 text-white/20 group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#4B7BFF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">Capture thoughts</h3>
                  <p className="text-[#A1A3A7] text-sm leading-relaxed">Organize your ideas and workflows in a high-precision workspace.</p>
                </div>
                <Button onClick={handleAddNote} className="bg-[#4B7BFF] text-white hover:bg-[#3B6BEF] rounded-xl px-8 h-12 text-sm font-medium shadow-lg shadow-[#4B7BFF]/10 active:scale-95 transition-all duration-200">
                  New Note
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden relative group/editor">
              {/* Toolbar - Header Integrated */}
              <div className="h-14 flex items-center justify-between px-10 bg-transparent z-30">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[#A1A3A7]/40 text-[11px] font-medium tracking-tight px-0">
                    <Clock className="w-3.5 h-3.5" />
                    Edited {selectedNote.updated_at ? formatRelativeDate(selectedNote.updated_at) : "just now"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => pinNote(selectedNote.id, !selectedNote.pinned)}
                    className={cn("h-8 w-8 rounded-lg transition-all duration-200", selectedNote.pinned ? "text-[#4B7BFF] bg-[#4B7BFF]/10" : "text-[#A1A3A7] hover:text-white hover:bg-white/5")}
                  >
                    <Pin className={cn("w-4 h-4", selectedNote.pinned && "fill-[#4B7BFF]")} />
                  </Button>
                  
                  <Separator orientation="vertical" className="h-4 mx-1 bg-white/10" />
                  
                  <Button variant="ghost" className="h-8 px-3 text-[11px] font-medium text-[#A1A3A7] hover:text-white hover:bg-white/5 gap-2 rounded-lg transition-all duration-200">
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#A1A3A7] hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200">
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl border-white/10 shadow-2xl bg-[#1A1A1E] text-[#E1E2E4]">
                      <DropdownMenuItem className="rounded-lg text-[12px] font-medium py-2 gap-2.5 cursor-pointer focus:bg-white/5 focus:text-white">
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteNote(selectedNote.id)}
                        className="rounded-lg text-[12px] font-medium py-2 text-rose-400 hover:text-rose-500 focus:bg-rose-500/10 gap-2.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="max-w-4xl mx-auto w-full px-12 pt-12 pb-40">
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => {
                      updateNoteLocal(selectedNote.id, { title: e.target.value })
                      debouncedUpdate(selectedNote.id, { title: e.target.value })
                    }}
                    className="w-full text-4xl font-semibold tracking-tight border-none bg-transparent focus-visible:outline-none mb-3 placeholder:text-white/10 text-white"
                    placeholder="Note Title"
                  />
                  <div className="flex items-center gap-4 text-[#A1A3A7] text-[13px] mb-12 px-1">
                    <div className="flex items-center gap-2 hover:text-white transition-colors cursor-default group/stat">
                      <Clock className="w-4 h-4 group-hover:text-[#4B7BFF] transition-colors" />
                      <span className="font-medium">Edited {formatRelativeDate(selectedNote.updated_at)}</span>
                    </div>
                    <span className="text-white/10">•</span>
                    <div className="flex items-center gap-2 hover:text-white transition-colors cursor-default group/stat">
                      <Share2 className="w-4 h-4 group-hover:text-[#4B7BFF] transition-colors" />
                      <span className="font-medium">Personal Workspace</span>
                    </div>
                  </div>
                  <NoteEditor 
                    content={selectedNote.content} 
                    onChange={(val) => {
                      const plainText = val
                        .replace(/<[^>]*>/g, '') 
                        .replace(/[#*`_~\[\]()]/g, '') 
                        .trim()
                      
                      const updates = { 
                        content: val,
                        excerpt: plainText.substring(0, 100) + (plainText.length > 100 ? '...' : '')
                      }
                      
                      updateNoteLocal(selectedNote.id, updates)
                      debouncedUpdate(selectedNote.id, updates)
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
