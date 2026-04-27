"use client"

import { Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { Note } from "@/types"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { getPlainTextFromStoredContent } from "@/lib/notes/note-content"

export function NotesGrid({ items, onDelete }: { items: Note[], onDelete?: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-0 border-t border-l border-white/5">
      {items.map((note) => (
        <NoteCard
          key={note.id}
          id={note.id}
          title={note.title}
          content={note.excerpt || note.body || getPlainTextFromStoredContent(note.content ?? null)}
          time={note.updated_at ? format(new Date(note.updated_at), 'MMM d') : ''}
          onDelete={onDelete}
        />
      ))}
      <QuickCreateModal 
        defaultType="note"
        trigger={
          <button type="button" className="w-full border-r border-b border-white/5 p-6 flex flex-col items-center justify-center gap-3 hover:bg-white/[0.01] cursor-pointer group transition-all h-[180px]">
            <Plus className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/10 group-hover:text-white/30 transition-colors">Add Note</span>
          </button>
        }
      />
    </div>
  )
}

function NoteCard({ id, title, content, time, onDelete }: { id: string, title: string, content: string, time: string, onDelete?: (id: string) => void }) {
  return (
    <div className="group border-r border-b border-white/5 p-6 flex flex-col h-[180px] hover:bg-white/[0.01] transition-all cursor-pointer relative overflow-hidden">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-[13px] font-medium text-white/80 truncate pr-4">{title || "Untitled"}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
          className="opacity-0 group-hover:opacity-100 text-white/10 hover:text-white/40 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <p className="text-[12px] text-white/30 line-clamp-4 leading-relaxed flex-1">
        {content || "Empty note..."}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/10">{time}</span>
      </div>
    </div>
  )
}
