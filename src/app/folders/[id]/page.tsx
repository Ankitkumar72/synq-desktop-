"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useProjectStore } from "@/shared"
import { useNotesStore } from "@/shared"
import { AnimatePage } from "@/components/layout/animate-page"
import { ArrowLeft, FolderKanban, FileText, Clock, Plus, Search, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Note } from "@/shared"

export default function FolderPage() {
  const params = useParams()
  const router = useRouter()
  const folderId = params.id as string

  const projects = useProjectStore(s => s.projects)
  const notes = useNotesStore(s => s.notes); const fetchNotes = useNotesStore(s => s.fetchNotes); const deleteNote = useNotesStore(s => s.deleteNote); const addNote = useNotesStore(s => s.addNote)
  const [searchQuery, setSearchQuery] = useState("")

  const folder = projects.find(p => p.id === folderId)

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  if (!folder) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <p className="text-stone-400">Folder not found.</p>
        <Button variant="outline" onClick={() => router.push("/folders")} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  const folderNotes = notes.filter(n => n.folder_id === folderId && !n.is_deleted && !n.is_task)
  const filteredNotes = folderNotes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleAddNote = async () => {
    const title = window.prompt("Enter note title:")
    if (!title) return
    
    const newId = await addNote({
      title,
      folder_id: folderId,
      pinned: false,
      tags: []
    })
    
    if (newId) {
      router.push(`/notes?id=${newId}`)
    }
  }

  return (
    <AnimatePage className="h-full w-full overflow-y-auto custom-scrollbar">
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.push("/folders")}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/5 text-stone-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white/90", folder.color || "bg-blue-500")}>
                <FolderKanban className="w-4 h-4" />
              </div>
              {folder.name}
            </h1>
            {folder.description && (
              <p className="text-stone-400 text-sm font-medium mt-1">{folder.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <h2 className="font-bold text-lg">Folder Notes</h2>
            <Badge variant="secondary" className="bg-white/10 text-stone-300 ml-2">{folderNotes.length}</Badge>
          </div>
          <Button 
            onClick={handleAddNote}
            className="bg-white text-black hover:bg-stone-200 h-9 rounded-full px-5 gap-2 font-bold text-sm shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            New Note
          </Button>
        </div>

        <div className="flex items-center gap-3 py-2 border-y border-white/5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <Input 
              placeholder="Search notes in this folder..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 border-white/5 bg-white/[0.03] focus-visible:bg-white/[0.05] focus-visible:ring-1 focus-visible:ring-white/10 text-sm text-white placeholder:text-stone-600 rounded-xl transition-all"
            />
          </div>
        </div>

        <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#141414] shadow-2xl min-h-[300px] flex flex-col mt-6">
          <div className="grid grid-cols-[1fr_140px_40px] gap-4 px-8 py-4 bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
            <div>Note Title</div>
            <div>Last Edited</div>
            <div></div>
          </div>
          <div className="divide-y divide-white/5 flex-1 relative">
            {filteredNotes.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                  <FileText className="w-6 h-6 text-stone-600" />
                </div>
                <p className="text-sm text-stone-400 font-bold uppercase tracking-wider">No notes found</p>
                <p className="text-xs text-stone-600">Create a new note to get started.</p>
              </div>
            ) : (
              filteredNotes.map((note: Note) => (
                <div 
                  key={note.id} 
                  className="grid grid-cols-[1fr_140px_40px] gap-4 px-8 py-4.5 items-center group hover:bg-white/[0.03] transition-all cursor-pointer"
                  onClick={() => router.push(`/notes?id=${note.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-stone-400 group-hover:text-white transition-all group-hover:scale-110 group-hover:bg-white/10">
                        <FileText className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[15px] font-semibold text-white group-hover:text-white transition-all">
                        {note.title || "Untitled Note"}
                      </span>
                      {note.excerpt && (
                        <span className="text-xs text-stone-500 truncate max-w-sm mt-0.5">
                          {note.excerpt}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-stone-600" />
                    {new Date(note.updated_at).toLocaleDateString()}
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNote(note.id)
                      }}
                      className="h-8 w-8 text-stone-700 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AnimatePage>
  )
}
