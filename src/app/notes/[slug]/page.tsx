"use client"

import { useParams } from "next/navigation"
import { useEffect } from "react"
import { useNotesStore } from "@/shared"
import { fromNoteSlug } from "@/lib/utils/note-slug"
import NotesPage from "../page"

export default function NoteSlugPage() {
  const params = useParams()
  const slug = params.slug as string
  const noteId = fromNoteSlug(slug)
  const setSelectedNoteId = useNotesStore(s => s.setSelectedNoteId)

  useEffect(() => {
    if (noteId) {
      setSelectedNoteId(noteId)
    }
  }, [noteId, setSelectedNoteId])

  return <NotesPage />
}
