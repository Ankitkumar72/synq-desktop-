"use client"

import { useEffect, useState } from 'react'
import { useEventStore } from '@/lib/store/use-event-store'
import { useNotesStore } from '@/lib/store/use-notes-store'
import { useUserStore } from '@/lib/store/use-user-store'

export default function TestPolymorphicPage() {
  const { user } = useUserStore()
  const [results, setResults] = useState<string[]>(user ? [] : ['❌ Waiting for user session...'])
  const eventStore = useEventStore()
  const notesStore = useNotesStore()

  useEffect(() => {
    async function runLiveTests() {
      if (!user) return

      const logs: string[] = []
      logs.push(`👤 Testing as user: ${user.email}`)

      try {
        logs.push('--- Test 1: EventStore Dual-Fetch ---')
        await eventStore.fetchEvents()
        logs.push(`✅ Fetched ${eventStore.events.length} events (includes polymorphic notes).`)

        logs.push('--- Test 2: NotesStore Filtered Fetch ---')
        await notesStore.fetchNotes()
        logs.push(`✅ Fetched ${notesStore.notes.length} notes (excludes scheduled items via web_notes view).`)

        // Verification of overlap
        const noteIds = new Set(notesStore.notes.map(n => n.id))
        const eventIdsInNotes = eventStore.events.filter(e => noteIds.has(e.id))
        
        if (eventIdsInNotes.length === 0) {
          logs.push('✅ SUCCESS: No overlap between Notes Store and Event Store.')
        } else {
          logs.push(`❌ FAILURE: Found ${eventIdsInNotes.length} overlapping items!`)
          eventIdsInNotes.forEach(e => logs.push(`   - Overlap: ${e.title} (${e.id})`))
        }

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logs.push(`💥 Error during tests: ${message}`)
      }

      setResults(logs)
    }

    if (user) {
      runLiveTests()
    }
  }, [user, eventStore, notesStore])

  return (
    <div className="p-8 font-mono bg-zinc-950 text-zinc-300 min-h-screen">
      <h1 className="text-2xl mb-6 text-white border-b border-zinc-800 pb-2">
        Polymorphic Storage Verification
      </h1>
      <div className="space-y-2">
        {results.map((log, i) => (
          <div key={i} className={log.includes('✅') ? 'text-emerald-400' : log.includes('❌') || log.includes('💥') ? 'text-rose-400' : ''}>
            {log}
          </div>
        ))}
        {!user && (
          <div className="mt-8 p-4 bg-zinc-900 border border-zinc-800 rounded">
            Please log in to the app in another tab to run these tests.
          </div>
        )}
      </div>
    </div>
  )
}

