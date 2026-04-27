"use client"

import { useState, useMemo, useEffect, useCallback, memo } from "react"
import { 
  StickyNote, 
  CheckSquare, 
  Calendar,
  RotateCcw,
  Trash2
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { AnimatePage } from "@/components/layout/animate-page"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { isExpired } from "@/lib/utils/trash-utils"

import { cn } from "@/lib/utils"
import { Note, Task, CalendarEvent } from "@/types"

type UnifiedTrashItem = Note | Task | CalendarEvent
type Category = 'notes' | 'tasks' | 'events'

const TrashItemRow = memo(({ 
  item, 
  isSelected, 
  onToggle, 
  onRestore, 
  onDelete, 
  category 
}: { 
  item: UnifiedTrashItem, 
  isSelected: boolean, 
  onToggle: (id: string) => void,
  onRestore: (id: string) => void,
  onDelete: (id: string) => void,
  category: Category
}) => {
  return (
    <div
      className={cn(
        "relative px-8 py-4 flex items-center gap-6 transition-colors duration-200",
        isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.01]"
      )}
    >
      <div className="w-5 flex items-center justify-center">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onToggle(item.id)}
          className="w-4 h-4 rounded bg-transparent border-white/10 checked:bg-white checked:border-white transition-all appearance-none cursor-pointer border"
        />
      </div>
      
      <div className="w-32 text-sm text-white/40 font-medium">
        {new Date(item.deleted_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
      </div>
      <div className="w-24 text-sm text-white/20 font-mono">
        {new Date(item.deleted_at!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}
      </div>

      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded border border-white/[0.03] flex items-center justify-center text-white/10 shrink-0">
          {category === 'notes' ? <StickyNote className="w-4 h-4" strokeWidth={1.5} /> : 
           category === 'tasks' ? <CheckSquare className="w-4 h-4" strokeWidth={1.5} /> :
           <Calendar className="w-4 h-4" strokeWidth={1.5} />}
        </div>
        <span className="text-base font-medium text-white/70 truncate">
          {item.title || "Untitled"}
        </span>
      </div>

      <div className="flex items-center gap-3 w-40 justify-end">
        <button 
          onClick={() => onRestore(item.id)}
          className="p-2 rounded-lg text-white/20 hover:text-white hover:bg-white/5 transition-all"
          title="Restore"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onDelete(item.id)}
          className="p-2 rounded-lg text-rose-500/20 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
          title="Delete Forever"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
})

TrashItemRow.displayName = 'TrashItemRow'

export default function TrashPage() {
  const { notes, restoreNote, permanentlyDeleteNote, fetchNotes } = useNotesStore()
  const { tasks, restoreTask, permanentlyDeleteTask, fetchTasks } = useTaskStore()
  const { events, restoreEvent, permanentlyDeleteEvent, fetchEvents } = useEventStore()
  
  const [activeCategory, setActiveCategory] = useState<Category>('notes')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  const [prevCategory, setPrevCategory] = useState<Category>(activeCategory)
  if (activeCategory !== prevCategory) {
    setPrevCategory(activeCategory)
    setSelectedIds(new Set())
  }

  useEffect(() => {
    fetchTasks(true)
    fetchEvents(true)
    fetchNotes(true)
  }, [fetchTasks, fetchEvents, fetchNotes])

  // Auto-purge items older than 15 days
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
      .sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()), [])

  const trashedNotes = useMemo(() => filterItems(notes as Note[]), [notes, filterItems])
  const trashedTasks = useMemo(() => filterItems(tasks as Task[]), [tasks, filterItems])
  const trashedEvents = useMemo(() => filterItems(events as CalendarEvent[]), [events, filterItems])

  const currentItems = activeCategory === 'notes' ? trashedNotes : activeCategory === 'tasks' ? trashedTasks : trashedEvents

  const emptyCategory = async () => {
    if (currentItems.length === 0) return
    if (confirm(`Permanently delete all ${activeCategory} in trash?`)) {
      for (const item of currentItems) {
        if (activeCategory === 'notes') await permanentlyDeleteNote(item.id)
        else if (activeCategory === 'tasks') await permanentlyDeleteTask(item.id)
        else await permanentlyDeleteEvent(item.id)
      }
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === currentItems.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(currentItems.map(i => i.id)))
  }

  const batchRestore = async () => {
    if (selectedIds.size === 0) return
    for (const id of selectedIds) {
      if (activeCategory === 'notes') await restoreNote(id)
      else if (activeCategory === 'tasks') await restoreTask(id)
      else await restoreEvent(id)
    }
    setSelectedIds(new Set())
  }

  const batchDelete = async () => {
    if (selectedIds.size === 0) return
    if (confirm(`Permanently delete ${selectedIds.size} items?`)) {
      for (const id of selectedIds) {
        if (activeCategory === 'notes') await permanentlyDeleteNote(id)
        else if (activeCategory === 'tasks') await permanentlyDeleteTask(id)
        else await permanentlyDeleteEvent(id)
      }
      setSelectedIds(new Set())
    }
  }

  return (
    <AnimatePage className="h-full bg-[#030303] flex flex-col font-sans overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-gradient-to-b from-white/[0.01] to-transparent" />
      </div>

      <header className="relative z-10 py-10 border-b border-white/[0.04] bg-[#030303]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-10 flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white tracking-tight">Trash</h1>
            <p className="text-sm text-white/30">Items are permanently removed after 15 days</p>
          </div>

          <div className="flex items-center gap-8">

            <nav className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-full border border-white/[0.05]">
              {(['notes', 'tasks', 'events'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 relative",
                    activeCategory === cat ? "text-white" : "text-white/30 hover:text-white/50"
                  )}
                >
                  {activeCategory === cat && (
                    <motion.div 
                      layoutId="active-cat"
                      className="absolute inset-0 bg-white/5 rounded-full"
                      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10 capitalize">{cat}</span>
                </button>
              ))}
            </nav>
            
            {currentItems.length > 0 && (
              <button 
                onClick={emptyCategory}
                className="text-xs font-medium text-white/10 hover:text-white/40 transition-colors"
              >
                Empty All
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-auto custom-scrollbar py-12">
        <div className="max-w-5xl mx-auto px-10">
          <AnimatePresence mode="wait">
            {currentItems.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[400px] flex flex-col items-center justify-center"
              >
                <p className="text-[12px] text-white/10 font-medium tracking-tight">No items in trash</p>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <AnimatePresence>
                  {selectedIds.size > 0 && (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -20 }}
                      className="flex items-center gap-6 px-8 py-5 bg-white/[0.03] rounded-2xl border border-white/[0.08] shadow-2xl backdrop-blur-xl z-20 sticky top-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <span className="text-[10px] text-black font-bold">{selectedIds.size}</span>
                        </div>
                        <span className="text-sm text-white/90 font-semibold tracking-tight">Items Selected</span>
                      </div>
                      
                      <div className="h-6 w-px bg-white/10 mx-2" />
                      
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={batchRestore} 
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all active:scale-95"
                        >
                          Restore Selected
                        </button>
                        <button 
                          onClick={batchDelete} 
                          className="px-4 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-white/0 hover:border-rose-500/20 rounded-full transition-all active:scale-95"
                        >
                          Delete Forever
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div 
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-white/[0.03] rounded-lg overflow-hidden bg-[#050505]"
                >
                {/* List Header */}
                <div className="px-8 py-4 border-b border-white/[0.03] flex items-center gap-6 text-[11px] text-white/20 font-medium uppercase tracking-[0.15em] bg-white/[0.01]">
                  <div className="w-5 flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === currentItems.length && currentItems.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded bg-transparent border-white/10 checked:bg-white checked:border-white transition-all appearance-none cursor-pointer border"
                    />
                  </div>
                  <div className="w-32">Date</div>
                  <div className="w-24">Time</div>
                  <div className="flex-1">Title</div>
                  <div className="w-40 text-right pr-20">Actions</div>
                </div>

                <div className="divide-y divide-white/[0.02]">
                  {currentItems.map((item) => (
                    <TrashItemRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      onToggle={toggleSelection}
                      onRestore={(id) => {
                        if (activeCategory === 'notes') restoreNote(id)
                        else if (activeCategory === 'tasks') restoreTask(id)
                        else restoreEvent(id)
                      }}
                      onDelete={(id) => {
                        if (activeCategory === 'notes') permanentlyDeleteNote(id)
                        else if (activeCategory === 'tasks') permanentlyDeleteTask(id)
                        else permanentlyDeleteEvent(id)
                      }}
                      category={activeCategory}
                    />
                  ))}
                </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </AnimatePage>
  )
}
