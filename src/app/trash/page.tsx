"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { 
  Trash2, 
  RotateCcw, 
  StickyNote, 
  CheckSquare, 
  Calendar,
  Search,
  X
} from "lucide-react"
import { AnimatePage } from "@/components/layout/animate-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { getDaysRemaining, isExpired } from "@/lib/utils/trash-utils"
import { formatRelativeDate } from "@/lib/utils/date-utils"
import { cn } from "@/lib/utils"
import { Note, Task, CalendarEvent } from "@/types"

type UnifiedTrashItem = Note | Task | CalendarEvent

export default function TrashPage() {
  const { notes, restoreNote, permanentlyDeleteNote, fetchNotes } = useNotesStore()
  const { tasks, restoreTask, permanentlyDeleteTask, fetchTasks } = useTaskStore()
  const { events, restoreEvent, permanentlyDeleteEvent, fetchEvents } = useEventStore()
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    // Initial fetch of all items including trashed ones
    fetchTasks(true)
    fetchEvents(true)
    fetchNotes(true)
  }, [fetchTasks, fetchEvents, fetchNotes])

  // Auto-purge items older than 15 days on mount
  useEffect(() => {
    const purgeExpired = async () => {
      const expiredNotes = notes.filter(n => n.deleted_at && isExpired(n.deleted_at))
      const expiredTasks = tasks.filter(t => t.deleted_at && isExpired(t.deleted_at))
      const expiredEvents = events.filter(e => e.deleted_at && isExpired(e.deleted_at))
      
      for (const note of expiredNotes) await permanentlyDeleteNote(note.id)
      for (const task of expiredTasks) await permanentlyDeleteTask(task.id)
      for (const event of expiredEvents) await permanentlyDeleteEvent(event.id)
    }
    
    purgeExpired()
  }, [notes, tasks, events, permanentlyDeleteNote, permanentlyDeleteTask, permanentlyDeleteEvent])

  const filterItems = useCallback((items: UnifiedTrashItem[]) =>
    items
      .filter(i => i.deleted_at)
      .filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()), [searchQuery])

  const trashedNotes = useMemo(() => filterItems(notes as Note[]), [notes, filterItems])
  const trashedTasks = useMemo(() => filterItems(tasks as Task[]), [tasks, filterItems])
  const trashedEvents = useMemo(() => filterItems(events as CalendarEvent[]), [events, filterItems])

  const emptyTrash = async (type: 'notes' | 'tasks' | 'events') => {
    const items = type === 'notes' ? trashedNotes : type === 'tasks' ? trashedTasks : trashedEvents
    if (items.length === 0) return

    if (confirm(`Are you sure you want to permanently delete all ${type} in the trash?`)) {
      if (type === 'notes') {
        for (const note of trashedNotes) await permanentlyDeleteNote(note.id)
      } else if (type === 'tasks') {
        for (const task of trashedTasks) await permanentlyDeleteTask(task.id)
      } else {
        for (const event of trashedEvents) await permanentlyDeleteEvent(event.id)
      }
    }
  }

  return (
    <AnimatePage>
      <div className="flex flex-col h-full bg-[#0a0a0a]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-20">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white/90">Trash</h1>
            <p className="text-[12px] text-stone-500 mt-0.5">Deleted items are removed after 15 days.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-600" />
              <Input 
                placeholder="Search trash..." 
                className="pl-9 w-64 bg-white/[0.03] border-white/5 text-[13px] h-9 rounded-xl focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500/20 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-stone-300 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/5 transition-all text-[16px] font-semibold px-7 h-12 rounded-xl border-white/30"
              onClick={() => {
                if (trashedNotes.length > 0) emptyTrash('notes')
                else if (trashedTasks.length > 0) emptyTrash('tasks')
                else if (trashedEvents.length > 0) emptyTrash('events')
              }}
              disabled={trashedNotes.length === 0 && trashedTasks.length === 0 && trashedEvents.length === 0}
            >
              Empty All
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 max-w-7xl mx-auto w-full">
          <Tabs defaultValue="notes" className="w-full">
            <div className="flex items-center justify-center mb-20">
              <TabsList className="bg-white/[0.03] border border-white/20 p-1.5 rounded-[22px]">
                {[
                  { key: "notes", label: "Notes", count: trashedNotes.length },
                  { key: "tasks", label: "Tasks", count: trashedTasks.length },
                  { key: "events", label: "Events", count: trashedEvents.length }
                ].map(tab => (
                  <TabsTrigger 
                    key={tab.key}
                    value={tab.key} 
                    className="px-9 py-3.5 rounded-[18px] data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-stone-300 border-2 border-transparent transition-all text-[17px] font-bold"
                  >
                    {tab.label} <span className="ml-3 text-[13px] opacity-40 font-medium">{tab.count}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="notes" className="mt-0 outline-none">
              <Grid items={trashedNotes} type="note" onRestore={restoreNote} onDelete={permanentlyDeleteNote} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 outline-none">
              <Grid items={trashedTasks} type="task" onRestore={restoreTask} onDelete={permanentlyDeleteTask} />
            </TabsContent>

            <TabsContent value="events" className="mt-0 outline-none">
              <Grid items={trashedEvents} type="event" onRestore={restoreEvent} onDelete={permanentlyDeleteEvent} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AnimatePage>
  )
}

function Grid({ items, type, onRestore, onDelete }: { 
  items: UnifiedTrashItem[], 
  type: 'note' | 'task' | 'event',
  onRestore: (id: string) => void,
  onDelete: (id: string) => void
}) {
  if (items.length === 0) return <EmptyTrashState type={type} />

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => (
        <TrashItemCard 
          key={item.id}
          title={item.title}
          type={type}
          deletedAt={item.deleted_at!}
          onRestore={() => onRestore(item.id)}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </div>
  )
}

function TrashItemCard({ 
  title, 
  type, 
  deletedAt, 
  onRestore, 
  onDelete 
}: { 
  title: string, 
  type: 'note' | 'task' | 'event', 
  deletedAt: string, 
  onRestore: () => void, 
  onDelete: () => void 
}) {
  const daysRemaining = getDaysRemaining(deletedAt)
  const isEmergency = daysRemaining <= 3

  return (
    <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 group flex flex-col gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-white/10 transition-all">
      <div className="flex items-start justify-between">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.03] border border-white/5 text-stone-400 group-hover:text-white transition-colors",
          type === 'note' && 'group-hover:text-indigo-400', 
          type === 'task' && 'group-hover:text-emerald-400', 
          type === 'event' && 'group-hover:text-amber-400'
        )}>
          {type === 'note' ? <StickyNote className="w-4 h-4" /> : 
           type === 'task' ? <CheckSquare className="w-4 h-4" /> :
           <Calendar className="w-4 h-4" />}
        </div>

        <div className={cn(
          "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight uppercase bg-white/5",
          isEmergency ? "text-rose-500" : "text-stone-500"
        )}>
          {daysRemaining}d left
        </div>
      </div>

      <div className="space-y-1.5 flex-1">
        <h3 className="text-[17px] font-bold text-stone-100 leading-tight line-clamp-1">
          {title || "Untitled"}
        </h3>
        <p className="text-[14px] text-stone-500 font-medium">Deleted {formatRelativeDate(deletedAt)}</p>
      </div>

      <div className="flex items-center gap-3 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 bg-white/[0.02] hover:bg-white/10 text-stone-100 hover:text-white border-white/30 rounded-xl text-[15px] h-12 font-bold transition-all"
          onClick={onRestore}
        >
          <RotateCcw className="w-5 h-5 mr-3" />
          Restore
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          className="w-12 h-12 rounded-xl text-stone-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all border-white/30 hover:border-rose-500/40"
          onClick={onDelete}
        >
          <X className="w-5.5 h-5.5" />
        </Button>
      </div>
    </div>
  )
}

function EmptyTrashState({ type }: { type: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6">
        <Trash2 className="w-6 h-6 text-stone-800" strokeWidth={1} />
      </div>
      <h3 className="text-base font-semibold text-stone-200">Empty Trash</h3>
      <p className="text-[13px] text-stone-600 mt-1 max-w-[240px] font-medium mx-auto">
        Your deleted {type} will appear here and stay for 15 days.
      </p>
    </div>
  )
}
