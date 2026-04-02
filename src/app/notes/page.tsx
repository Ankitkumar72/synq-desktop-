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
      <div className="flex h-screen bg-white">
        {/* Search and List Side Column */}
        <div className="w-[360px] border-r border-[#eee] flex flex-col bg-[#F7F7F8]">
          <div className={cn(
            "p-6 space-y-4 transition-all duration-300",
            !isSidebarOpen && "pl-16"
          )}>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Notes</h1>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleAddNote}
                className="h-8 w-8 text-stone-400 hover:text-black hover:bg-stone-100 rounded-full transition-all"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-[#6366f1] transition-colors" />
              <Input 
                placeholder="Search notes..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-none bg-white shadow-sm hover:shadow-md focus:shadow-md text-sm focus-visible:ring-1 focus-visible:ring-stone-100 rounded-xl transition-all"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-stone-50">
              {filteredNotes.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <p className="text-sm font-medium text-stone-400">No notes found</p>
                  <Button variant="link" size="sm" onClick={() => setSearchQuery("")} className="text-xs text-stone-400">Clear search</Button>
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
                        "mx-3 my-1 p-4 cursor-pointer transition-all hover:bg-white/80 group relative rounded-xl border-l-[3px]",
                        selectedNoteId === note.id ? "bg-[#eef2ff] border-l-[#6366f1] shadow-sm" : "border-l-transparent hover:bg-stone-100/50"
                      )}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h3 className={cn(
                          "text-[14px] font-semibold truncate pr-4 leading-tight py-0.5",
                          selectedNoteId === note.id ? "text-[#6366f1]" : "text-stone-700"
                        )}>
                          {note.title}
                        </h3>
                        {note.pinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-300 shrink-0 mt-0.5" />}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[12px] text-stone-400 font-medium">
                          {formatRelativeDate(note.updated_at)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {note.tags.slice(0, 1).map(tag => (
                            <span key={tag} className="text-[10px] font-semibold text-stone-400 bg-stone-200/50 px-1.5 py-0.5 rounded-md">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </NoteContextMenu>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Editor Main Area */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {!selectedNote ? (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center space-y-6 max-w-sm">
                <div className="w-24 h-24 rounded-3xl bg-stone-50 flex items-center justify-center mx-auto border border-stone-100 shadow-sm relative overflow-hidden group">
                  <Plus className="w-12 h-12 text-stone-200 group-hover:scale-110 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#6366f1]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-stone-900">Start writing your thoughts…</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">Capture ideas, create checklists, and organize your workspace with ease.</p>
                </div>
                <Button onClick={handleAddNote} className="bg-[#6366f1] text-white hover:bg-[#5558e3] rounded-xl px-8 h-12 text-sm font-medium shadow-xl shadow-[#6366f1]/10 hover:shadow-[#6366f1]/20 active:scale-95 transition-all">
                  Create New Note
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="h-16 flex items-center justify-between px-8 border-b border-[#f1f1f1] bg-white/80 backdrop-blur-md z-30 sticky top-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-stone-300 text-[10px] font-bold uppercase tracking-widest bg-stone-50 px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    Edited {formatRelativeDate(selectedNote.updated_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => pinNote(selectedNote.id, !selectedNote.pinned)}
                    className={cn("h-9 w-9 rounded-full transition-all", selectedNote.pinned ? "text-amber-500 bg-amber-50" : "text-stone-300 hover:text-stone-900 hover:bg-stone-50")}
                  >
                    <Pin className={cn("w-4 h-4", selectedNote.pinned && "fill-amber-500")} />
                  </Button>
                  
                  <Separator orientation="vertical" className="h-4 mx-2 bg-stone-100" />
                  
                  <Button variant="ghost" className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 hover:bg-stone-50 gap-2 rounded-full">
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-stone-300 hover:text-stone-900 hover:bg-stone-50 rounded-full transition-all">
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl border-stone-100 shadow-2xl bg-white/95 backdrop-blur-xl">
                      <DropdownMenuItem className="rounded-xl text-[10px] font-bold uppercase tracking-widest py-3 text-stone-500 gap-3 cursor-pointer focus:bg-stone-50 focus:text-stone-900">
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteNote(selectedNote.id)}
                        className="rounded-xl text-[10px] font-bold uppercase tracking-widest py-3 text-rose-500 hover:text-rose-600 focus:bg-rose-50/50 gap-3 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <ScrollArea className="flex-1 bg-white">
                <div className="max-w-4xl mx-auto w-full px-8 pt-8 pb-32">
                    <input
                      type="text"
                      value={selectedNote.title}
                      onChange={(e) => {
                        updateNoteLocal(selectedNote.id, { title: e.target.value })
                        debouncedUpdate(selectedNote.id, { title: e.target.value })
                      }}
                      className="w-full text-[40px] font-semibold tracking-tight border-none focus-visible:outline-none mb-2 placeholder:text-stone-100 font-heading text-stone-900"
                      placeholder="Note Title"
                    />
                    <div className="flex items-center gap-4 text-stone-400 text-sm mb-12">
                      <div className="flex items-center gap-1.5 hover:text-stone-600 transition-colors cursor-default">
                        <Clock className="w-4 h-4" />
                        <span>Last edited {formatRelativeDate(selectedNote.updated_at)}</span>
                      </div>
                      <span className="text-stone-200">•</span>
                      <div className="flex items-center gap-1.5 hover:text-stone-600 transition-colors cursor-default">
                        <Share2 className="w-4 h-4" />
                        <span>Private Workspace</span>
                      </div>
                      <span className="text-stone-200">•</span>
                      <div className="flex items-center gap-1.5 text-stone-300">
                        <span>❤️</span>
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
            </>
          )}
        </div>
      </div>
    </AnimatePage>
  )
}
