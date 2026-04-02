"use client"

import { useState, useMemo } from "react"
import { 
  Trash2, 
  RotateCcw, 
  Trash, 
  StickyNote, 
  CheckSquare, 
  Clock, 
  Search,
  Calendar
} from "lucide-react"
import { AnimatePage } from "@/components/layout/animate-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { getDaysRemaining, isExpired } from "@/lib/utils/trash-utils"
import { formatRelativeDate } from "@/lib/utils/date-utils"
import { cn } from "@/lib/utils"
import { useEffect } from "react"

export default function TrashPage() {
  const { notes, restoreNote, permanentlyDeleteNote } = useNotesStore()
  const { tasks, restoreTask, permanentlyDeleteTask } = useTaskStore()
  const { events, restoreEvent, permanentlyDeleteEvent } = useEventStore()
  const [searchQuery, setSearchQuery] = useState("")

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

  const trashedNotes = useMemo(() => 
    notes.filter(n => n.deleted_at).filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()),
    [notes, searchQuery]
  )

  const trashedTasks = useMemo(() => 
    tasks.filter(t => t.deleted_at).filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()),
    [tasks, searchQuery]
  )

  const trashedEvents = useMemo(() => 
    events.filter(e => e.deleted_at).filter(e => 
      e.title.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()),
    [events, searchQuery]
  )

  const emptyTrash = async (type: 'notes' | 'tasks' | 'events') => {
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
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-3">
              <Trash2 className="w-6 h-6 text-stone-400" />
              Trash
            </h1>
            <p className="text-stone-500 text-sm font-medium">Items stay here for 15 days before permanent deletion.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-[#6366f1] transition-colors" />
              <Input 
                placeholder="Search trash..." 
                className="pl-10 h-10 rounded-full border-stone-200 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-8">
          <Tabs defaultValue="notes" className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <TabsList className="bg-stone-50 p-1 rounded-full w-fit">
                <TabsTrigger value="notes" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm transition-all text-sm font-bold">
                  Notes ({trashedNotes.length})
                </TabsTrigger>
                <TabsTrigger value="tasks" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm transition-all text-sm font-bold">
                  Tasks ({trashedTasks.length})
                </TabsTrigger>
                <TabsTrigger value="events" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm transition-all text-sm font-bold">
                  Events ({trashedEvents.length})
                </TabsTrigger>
              </TabsList>

              <Button 
                variant="ghost" 
                size="sm"
                className="text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-all gap-2 rounded-full px-4 font-bold"
                onClick={() => {
                  if (trashedNotes.length > 0) emptyTrash('notes')
                  else if (trashedTasks.length > 0) emptyTrash('tasks')
                  else if (trashedEvents.length > 0) emptyTrash('events')
                }}
                disabled={trashedNotes.length === 0 && trashedTasks.length === 0 && trashedEvents.length === 0}
              >
                <Trash className="w-4 h-4" />
                Empty Trash
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="notes" className="m-0 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trashedNotes.length === 0 ? (
                    <EmptyTrashState type="notes" />
                  ) : (
                    trashedNotes.map(note => (
                      <TrashItemCard 
                        key={note.id}
                        title={note.title}
                        type="note"
                        deletedAt={note.deleted_at!}
                        onRestore={() => restoreNote(note.id)}
                        onDelete={() => permanentlyDeleteNote(note.id)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="m-0 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trashedTasks.length === 0 ? (
                    <EmptyTrashState type="tasks" />
                  ) : (
                    trashedTasks.map(task => (
                      <TrashItemCard 
                        key={task.id}
                        title={task.title}
                        type="task"
                        deletedAt={task.deleted_at!}
                        onRestore={() => restoreTask(task.id)}
                        onDelete={() => permanentlyDeleteTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="events" className="m-0 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trashedEvents.length === 0 ? (
                    <EmptyTrashState type="events" />
                  ) : (
                    trashedEvents.map(event => (
                      <TrashItemCard 
                        key={event.id}
                        title={event.title}
                        type="event"
                        deletedAt={event.deleted_at!}
                        onRestore={() => restoreEvent(event.id)}
                        onDelete={() => permanentlyDeleteEvent(event.id)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </div>
    </AnimatePage>
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

  return (
    <div className="group bg-white border border-stone-200/60 rounded-2xl p-5 hover:shadow-xl hover:shadow-stone-200/30 transition-all flex flex-col gap-4 relative overflow-hidden h-48">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-stone-50/50 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform" />
      
      <div className="flex items-start justify-between relative z-10">
        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 group-hover:bg-[#6366f1]/5 group-hover:border-[#6366f1]/20 transition-all">
          {type === 'note' ? <StickyNote className="w-5 h-5 text-stone-400 group-hover:text-[#6366f1]" /> : 
           type === 'task' ? <CheckSquare className="w-5 h-5 text-stone-400 group-hover:text-[#6366f1]" /> :
           <Calendar className="w-5 h-5 text-stone-400 group-hover:text-[#6366f1]" />}
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
          daysRemaining <= 3 ? "bg-rose-50 text-rose-500 shadow-sm shadow-rose-200/50" : "bg-emerald-50 text-emerald-600"
        )}>
          <Clock className="w-3 h-3" />
          {daysRemaining} Days Left
        </div>
      </div>

      <div className="flex-1 relative z-10">
        <h3 className="text-base font-bold text-stone-800 line-clamp-2 leading-tight group-hover:text-stone-900 transition-colors">
          {title || "Untitled Item"}
        </h3>
        <p className="text-[11px] text-stone-400 mt-2 font-medium">Deleted {formatRelativeDate(deletedAt)}</p>
      </div>

      <div className="flex items-center gap-2 relative z-10 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
        <Button 
          variant="outline"
          size="sm" 
          className="flex-1 h-9 rounded-xl border-stone-200 text-stone-600 hover:text-[#6366f1] hover:bg-[#6366f1]/5 hover:border-[#6366f1]/30 transition-all gap-2 font-bold text-[11px] uppercase tracking-wider"
          onClick={onRestore}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restore
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 rounded-xl text-stone-300 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all shrink-0"
          onClick={onDelete}
        >
          <Trash className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function EmptyTrashState({ type }: { type: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-24 h-24 rounded-full bg-stone-50 flex items-center justify-center mb-6 group border border-stone-100/50">
        <Trash2 className="w-10 h-10 text-stone-200 group-hover:scale-110 transition-transform duration-300" />
      </div>
      <h3 className="text-xl font-bold text-stone-800 mb-2">Trash is empty</h3>
      <p className="text-sm text-stone-400 max-w-[240px] leading-relaxed font-medium">Any {type} you delete will linger here for 15 days before permanent removal.</p>
    </div>
  )
}
