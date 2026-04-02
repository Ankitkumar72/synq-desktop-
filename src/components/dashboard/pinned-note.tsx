"use client"

import { FileText, Pin } from "lucide-react"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useHasMounted } from "@/hooks/use-has-mounted"
import Link from "next/link"

export function PinnedNote() {
  const { notes } = useNotesStore()
  const hasMounted = useHasMounted()
  const pinnedNotes = notes.filter(n => !n.deleted_at)
  const pinnedNote = pinnedNotes.find(n => n.pinned) || pinnedNotes[0]

  if (!hasMounted || !pinnedNote) return null

  return (
    <div className="bg-white border border-stone-200/60 rounded-[12px] overflow-hidden h-full shadow-sm">
      <div className="p-5 border-b border-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pin className="w-3 h-3 text-stone-900 fill-stone-900" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">Pinned Note</h3>
        </div>
      </div>
      <div className="p-5">
        <h4 className="text-[14px] font-bold text-stone-900 mb-2 truncate">{pinnedNote.title}</h4>
        <div 
          className="text-[13px] text-stone-500 line-clamp-4 leading-relaxed font-medium mb-6"
          dangerouslySetInnerHTML={{ __html: pinnedNote.content }}
        />
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-stone-50">
          <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold uppercase tracking-widest">
            <FileText className="w-3.5 h-3.5" />
            <span>Updated {new Date(pinnedNote.updated_at || pinnedNote.created_at).toLocaleDateString()}</span>
          </div>
          <Link href="/notes">
            <span className="text-[10px] text-stone-900 font-bold uppercase tracking-[0.1em] cursor-pointer hover:underline underline-offset-4">
              Open Editor
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
