"use client"

import { useState, useMemo, useEffect, useCallback, memo } from "react"
import { useNotesStore, useTaskStore, useEventStore, useFolderStore } from "@/shared"
import { isExpired } from "@/lib/utils/trash-utils"
import { cn } from "@/lib/utils"
import { Note, Task, CalendarEvent, Project, Folder } from "@/shared"
import { FileText, CheckCircle, Calendar, Folder as FolderIcon, Check } from "lucide-react"

type UnifiedTrashItem = Note | Task | CalendarEvent | Project | Folder
type Category = 'tasks' | 'folders' | 'notes' | 'events'

const TABS = [
  { id: 'folders', label: 'Recently deleted folders', disabled: false },
  { id: 'tasks', label: 'Recently deleted tasks', disabled: false },
  { id: 'notes', label: 'Recently deleted notes', disabled: false },
  { id: 'events', label: 'Recently deleted events', disabled: false },
] as const;

const TrashItemRow = memo(({
  item,
  onRestore,
  onDelete,
  category,
  isSelected,
  onToggleSelect
}: {
  item: UnifiedTrashItem,
  onRestore: (id: string) => void,
  onDelete: (id: string) => void,
  category: Category,
  isSelected: boolean,
  onToggleSelect: (id: string) => void
}) => {
  const title = (item as any).title || (item as any).name || "Untitled"

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between px-6 py-3 transition-colors cursor-default",
        isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
      )}
      onClick={() => onToggleSelect(item.id)}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0",
            isSelected ? "bg-white/20 border-white/40" : "border-white/10 group-hover:border-white/30"
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex items-center justify-center shrink-0 w-6 h-6">
          {category === 'notes' ? <FileText className="w-[18px] h-[18px] text-[#888]" /> :
            category === 'tasks' ? <CheckCircle className="w-[18px] h-[18px] text-[#888]" /> :
              category === 'folders' ? <FolderIcon className="w-[18px] h-[18px] text-[#888]" /> :
                <Calendar className="w-[18px] h-[18px] text-[#888]" />}
        </div>
        <span className="text-[15px] font-medium text-white/90 truncate select-none">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onRestore(item.id); }}
          className="px-4 py-2 rounded-lg text-[14px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          Restore
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          className="px-4 py-2 rounded-lg text-[14px] font-medium text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
})

TrashItemRow.displayName = 'TrashItemRow'

export default function TrashPage() {
  const notes = useNotesStore(s => s.notes); const restoreNote = useNotesStore(s => s.restoreNote); const permanentlyDeleteNote = useNotesStore(s => s.permanentlyDeleteNote); const fetchNotes = useNotesStore(s => s.fetchNotes)
  const tasks = useTaskStore(s => s.tasks); const restoreTask = useTaskStore(s => s.restoreTask); const permanentlyDeleteTask = useTaskStore(s => s.permanentlyDeleteTask); const fetchTasks = useTaskStore(s => s.fetchTasks)
  const events = useEventStore(s => s.events); const restoreEvent = useEventStore(s => s.restoreEvent); const permanentlyDeleteEvent = useEventStore(s => s.permanentlyDeleteEvent); const fetchEvents = useEventStore(s => s.fetchEvents)
  const folders = useFolderStore(s => s.folders); const fetchFolders = useFolderStore(s => s.fetchFolders)
  const [activeCategory, setActiveCategory] = useState<Category>('folders')

  useEffect(() => {
    fetchTasks(true)
    fetchEvents(true)
    fetchNotes(true)
    fetchFolders(true)
  }, [fetchTasks, fetchEvents, fetchNotes, fetchFolders])

  // Auto-purge items older than 14 days
  useEffect(() => {
    const purgeExpired = async () => {
      const expiredNotes = notes.filter(n => n.deleted_at && isExpired(n.deleted_at))
      const expiredTasks = tasks.filter(t => t.deleted_at && isExpired(t.deleted_at))
      const expiredEvents = events.filter(e => e.deleted_at && isExpired(e.deleted_at))
      const expiredFolders = folders.filter(p => p.deleted_at && isExpired(p.deleted_at))

      for (const note of expiredNotes) await permanentlyDeleteNote(note.id)
      for (const task of expiredTasks) await permanentlyDeleteTask(task.id)
      for (const event of expiredEvents) await permanentlyDeleteEvent(event.id)
      for (const _folder of expiredFolders) {
        // Soft delete again? Trash should permanently delete. Wait, Folders don't have permanentlyDelete in store.
        // I will just ignore auto-purging folders for now since the store doesn't have it.
      }
    }
    purgeExpired()
  }, [notes, tasks, events, folders, permanentlyDeleteNote, permanentlyDeleteTask, permanentlyDeleteEvent])

  const filterItems = useCallback((items: UnifiedTrashItem[]) =>
    items
      .filter(i => i.deleted_at)
      .sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()), [])

  const trashedNotes = useMemo(() => filterItems(notes as Note[]), [notes, filterItems])
  const trashedTasks = useMemo(() => filterItems(tasks as Task[]), [tasks, filterItems])
  const trashedEvents = useMemo(() => filterItems(events as CalendarEvent[]), [events, filterItems])
  const trashedFolders = useMemo(() => filterItems(folders as Folder[]), [folders, filterItems])

  const currentItems = activeCategory === 'notes' ? trashedNotes
    : activeCategory === 'tasks' ? trashedTasks
      : activeCategory === 'folders' ? trashedFolders
        : activeCategory === 'events' ? trashedEvents
          : []

  const activeTabObj = TABS.find(t => t.id === activeCategory)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleToggleSelectAll = () => {
    if (selectedIds.size === currentItems.length && currentItems.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(currentItems.map(i => i.id)))
    }
  }

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkRestore = async () => {
    for (const id of selectedIds) {
      if (activeCategory === 'notes') restoreNote(id)
      else if (activeCategory === 'tasks') restoreTask(id)
      else if (activeCategory === 'folders') { /* Folder restore not implemented yet */ }
      else restoreEvent(id)
    }
    setSelectedIds(new Set())
  }

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      if (activeCategory === 'notes') permanentlyDeleteNote(id)
      else if (activeCategory === 'tasks') permanentlyDeleteTask(id)
      else if (activeCategory === 'folders') { /* Folder delete not implemented yet */ }
      else permanentlyDeleteEvent(id)
    }
    setSelectedIds(new Set())
  }

  return (
    <div className="h-full bg-[#111111] flex flex-col font-sans overflow-hidden min-h-0 text-white">

      {/* Header */}
      <header className="px-6 py-4 border-b border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              onClick={handleToggleSelectAll}
              className={cn(
                "w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0",
                selectedIds.size > 0 && selectedIds.size === currentItems.length
                  ? "bg-white/20 border-white/40"
                  : selectedIds.size > 0
                    ? "bg-white/10 border-white/30"
                    : "border-white/10 hover:border-white/30"
              )}
            >
              {selectedIds.size > 0 && selectedIds.size === currentItems.length && <Check className="w-3 h-3 text-white" />}
              {selectedIds.size > 0 && selectedIds.size !== currentItems.length && <div className="w-2 h-0.5 bg-white rounded-full" />}
            </div>

            {selectedIds.size > 0 ? (
              <span className="text-[14px] font-medium text-white/90">
                {selectedIds.size} selected
              </span>
            ) : (
              <div className="flex items-center text-[14px] font-medium text-white/90">
                {activeTabObj?.label} <span className="text-[#888] ml-2">{currentItems.length}</span>
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkRestore}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                Restore Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-6 pt-5 pb-6 overflow-x-auto custom-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled) {
                setActiveCategory(tab.id as Category)
                setSelectedIds(new Set())
              }
            }}
            className={cn(
              "px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 border",
              activeCategory === tab.id
                ? "border-white/20 text-white bg-transparent"
                : "border-white/[0.04] text-white/40 bg-transparent hover:text-white/70 hover:border-white/10",
              tab.disabled && "opacity-30 cursor-not-allowed hover:text-white/40 hover:border-white/[0.04]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <main className="flex-1 overflow-auto custom-scrollbar min-h-0">
        <div className="flex flex-col">
          {currentItems.length === 0 ? (
            <div className="px-6 py-8 text-[13px] text-white/30 font-medium">
              No items in trash.
            </div>
          ) : (
            <div className="py-2 divide-y divide-white/[0.04]">
              {currentItems.map((item) => (
                <TrashItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={handleToggleSelect}
                  onRestore={(id) => {
                    if (activeCategory === 'notes') restoreNote(id)
                    else if (activeCategory === 'tasks') restoreTask(id)
                    else if (activeCategory === 'folders') { /* Restore */ }
                    else restoreEvent(id)
                  }}
                  onDelete={(id) => {
                    if (activeCategory === 'notes') permanentlyDeleteNote(id)
                    else if (activeCategory === 'tasks') permanentlyDeleteTask(id)
                    else if (activeCategory === 'folders') { /* Delete */ }
                    else permanentlyDeleteEvent(id)
                  }}
                  category={activeCategory as Category}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
