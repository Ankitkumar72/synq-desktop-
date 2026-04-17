"use client"

import { FileText, Pin, MoreHorizontal } from "lucide-react"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow, parseISO } from "date-fns"
import Link from "next/link"

export function PinnedNote() {
  const { notes } = useNotesStore()
  const hasMounted = useHasMounted()
  const pinnedNotes = notes.filter(n => !n.deleted_at)
  const pinnedNote = pinnedNotes.find(n => n.pinned) || pinnedNotes[0]

  if (!hasMounted) return <Skeleton className="h-[320px] w-full rounded-[24px] bg-white/5" />
  if (!pinnedNote) return null

  return (
    <div className="zen-card overflow-hidden h-full flex flex-col group p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/5 rounded-full">
            <Pin className="w-3.5 h-3.5 text-stone-100 fill-stone-100" />
          </div>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-stone-500">Insight</h3>
        </div>
        <button className="text-stone-300 hover:text-stone-100 transition-colors opacity-0 group-hover:opacity-100">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 flex flex-col">
        <h4 className="text-[18px] font-black text-stone-100 mb-4 tracking-tighter font-display leading-tight">
          {pinnedNote.title}
        </h4>
        <div 
          className="text-[14px] text-stone-400 line-clamp-6 leading-[1.6] font-medium mb-8 prose prose-sm prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: pinnedNote.content || '' }}
        />
        <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5">
          <div className="flex items-center gap-2.5 text-[10px] text-stone-500 font-extrabold uppercase tracking-widest">
            <FileText className="w-3.5 h-3.5 text-stone-600" />
            <span>Updated {formatDistanceToNow(parseISO(pinnedNote.updated_at || pinnedNote.created_at), { addSuffix: true })}</span>
          </div>
          <Link href="/notes">
            <span className="text-[10px] text-stone-100 font-extrabold uppercase tracking-[0.1em] cursor-pointer hover:text-blue-500 transition-all">
              Refine Insight
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
