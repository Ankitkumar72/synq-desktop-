"use client"

import { Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { Note } from "@/types"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { getPlainTextFromStoredContent } from "@/lib/notes/note-content"

export function NotesGrid({ items, onDelete }: { items: Note[], onDelete?: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
            <button type="button" className="w-full bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/[0.04] cursor-pointer group transition-all h-[140px]">
              <Plus className="w-5 h-5 text-stone-700 group-hover:text-stone-300" />
              <span className="text-[12px] font-medium text-stone-700 group-hover:text-stone-500 font-mono uppercase tracking-widest">New Note</span>
            </button>
          }
        />
      </div>
    </div>
  )
}

function NoteCard({ id, title, content, time, onDelete }: { id: string, title: string, content: string, time: string, onDelete?: (id: string) => void }) {
  return (
    <div className="bg-[#202020] border border-white/5 rounded-xl p-4 space-y-3 group hover:bg-white/[0.02] transition-all cursor-pointer h-[140px] flex flex-col relative overflow-hidden shadow-sm">
      <div className="flex items-start justify-between min-w-0">
        <h3 className="text-[15px] font-bold text-white leading-tight truncate flex-1">{title || "Untitled"}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
          className="opacity-0 group-hover:opacity-100 p-1 text-stone-700 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[13px] text-stone-500 line-clamp-3 leading-relaxed flex-1">
        {content || "No content..."}
      </p>
      <div className="flex items-center justify-between pt-1">
         <span className="text-[10px] font-bold uppercase tracking-widest text-stone-700 font-mono">{time}</span>
      </div>
    </div>
  )
}
