"use client"

import { useState, useMemo } from "react"
import { 
  Plus,
  Clock,
  AlignLeft,
  Calendar as CalendarIcon,
  Bell,
  Repeat,
  ChevronDown,
  List
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger 
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTaskStore } from "@/shared"

const timeOptions = Array.from({ length: 24 * 4 }).map((_, i) => {
  const hours = Math.floor(i / 4);
  const minutes = (i % 4) * 15;
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  const value = `${hours.toString().padStart(2, '0')}:${displayMinutes}`;
  const label = `${displayHours}:${displayMinutes}${period}`;
  return { value, label };
});
import { useProjectStore } from "@/shared"
import { useNotesStore } from "@/shared"
import { useEventStore } from "@/shared"
import { AnimatePresence } from "framer-motion"
import { useUserStore } from "@/shared"
import { getUserDisplayName, getUserInitials } from "@/lib/user-utils"
import { RecurrenceModal } from "./recurrence-modal"
import { buildExcerpt, createNoteContentFromText } from "@/shared"
import { Task, CalendarEvent } from "@/shared"

export function QuickCreateModal({ 
  trigger, 
  defaultType = 'task',
  defaultDate: propDefaultDate,
  editItem = null,
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: { 
  trigger?: React.ReactElement | null, 
  defaultType?: 'task' | 'project' | 'note' | 'event',
  defaultDate?: Date,
  editItem?: (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' }) | null,
  open?: boolean,
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = setControlledOpen ?? setInternalOpen
  
  const defaultDate = useMemo(() => propDefaultDate ?? new Date(), [propDefaultDate])

  const [type, setType] = useState<'task' | 'project' | 'note' | 'event'>(editItem?.type || defaultType)
  const [title, setTitle] = useState(editItem?.title || "")
  const [description, setDescription] = useState(editItem?.description || "")
  const [priority, setPriority] = useState(
    (editItem?.type === 'task' ? editItem.priority?.charAt(0).toUpperCase() + editItem.priority?.slice(1) : "Medium") || "Medium"
  )
  const [dueDate, setDueDate] = useState<Date>(
    editItem?.type === 'task' 
      ? (editItem.start_at ? new Date(editItem.start_at) : (editItem.due_date ? new Date(editItem.due_date) : defaultDate))
      : (editItem?.type === 'event' ? new Date(editItem.start_date) : defaultDate)
  )
  
  // New state for Tasks
  const [allDay, setAllDay] = useState(false)
  const [startTime, setStartTime] = useState(() => {
    if (editItem?.type === 'task' && editItem.start_at) {
      const d = new Date(editItem.start_at)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    return "09:00"
  })
  const [endTime, setEndTime] = useState(() => {
    if (editItem?.type === 'task' && editItem.end_at) {
      const d = new Date(editItem.end_at)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    return "10:00"
  })
  const [reminder, setReminder] = useState("None")

  const [recurrence, setRecurrence] = useState(
    (editItem?.type === 'task' ? editItem.recurrence_rule : null) || "Does not repeat"
  )
  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)
  const user = useUserStore(s => s.user)
  const addTask = useTaskStore(s => s.addTask); const updateTask = useTaskStore(s => s.updateTask)
  const addProject = useProjectStore(s => s.addProject); const projects = useProjectStore(s => s.projects)
  const addNote = useNotesStore(s => s.addNote)
  const addEvent = useEventStore(s => s.addEvent); const updateEvent = useEventStore(s => s.updateEvent)

  const [prevOpen, setPrevOpen] = useState(open)
  const [prevEditId, setPrevEditId] = useState(editItem?.id)

  if (open && (!prevOpen || editItem?.id !== prevEditId)) {
    setPrevOpen(open)
    setPrevEditId(editItem?.id)
    
    setType(editItem?.type || defaultType)
    setTitle(editItem?.title || "")
    setDescription(editItem?.description || "")
    
    if (editItem?.type === 'task') {
      setPriority(editItem.priority ? editItem.priority.charAt(0).toUpperCase() + editItem.priority.slice(1) : "Medium")
      setDueDate(editItem.start_at ? new Date(editItem.start_at) : (editItem.due_date ? new Date(editItem.due_date) : defaultDate))
      
      if (editItem.start_at) {
        const d = new Date(editItem.start_at)
        setStartTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`)
      }
      if (editItem.end_at) {
        const d = new Date(editItem.end_at)
        setEndTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`)
      }
      
      setRecurrence(editItem.recurrence_rule || "Does not repeat")
      setSelectedProjectId(editItem.project_id || undefined)
    } else if (editItem?.type === 'event') {
      setDueDate(new Date(editItem.start_date))
    } else {
      setPriority("Medium")
      setDueDate(defaultDate)
      setRecurrence("Does not repeat")
      setSelectedProjectId(undefined)
      setStartTime("09:00")
      setEndTime("10:00")
      setAllDay(false)
      setReminder("None")
    }
  } else if (!open && prevOpen) {
    setPrevOpen(false)
  }

  const createDateWithTime = (date: Date, timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  const handleSave = () => {
    const finalTitle = title.trim() || "(No title)"

    if (editItem) {
      if (editItem.type === 'task') {
        let taskStart, taskEnd;
        if (allDay) {
          const d = new Date(dueDate);
          d.setHours(0,0,0,0);
          taskStart = d.toISOString();
          d.setHours(23,59,59,999);
          taskEnd = d.toISOString();
        } else {
          taskStart = createDateWithTime(dueDate, startTime).toISOString();
          taskEnd = createDateWithTime(dueDate, endTime).toISOString();
        }

        updateTask(editItem.id, {
          title: finalTitle,
          description,
          priority: priority.toLowerCase() as "low" | "medium" | "high",
          project_id: selectedProjectId,
          due_date: taskStart.split('T')[0],
          start_at: taskStart,
          end_at: taskEnd,
          recurrence_rule: recurrence === "Does not repeat" ? undefined : recurrence
        })
      } else if (editItem.type === 'event') {
        updateEvent(editItem.id, {
          title: finalTitle,
          description,
          start_date: dueDate.toISOString(),
          end_date: new Date(dueDate.getTime() + 3600000).toISOString(),
        })
      }
    } else {
      if (type === 'task') {
        let taskStart, taskEnd;
        if (allDay) {
          const d = new Date(dueDate);
          d.setHours(0,0,0,0);
          taskStart = d.toISOString();
          d.setHours(23,59,59,999);
          taskEnd = d.toISOString();
        } else {
          taskStart = createDateWithTime(dueDate, startTime).toISOString();
          taskEnd = createDateWithTime(dueDate, endTime).toISOString();
        }

        addTask({
          title: finalTitle,
          description,
          status: 'todo',
          priority: priority.toLowerCase() as "low" | "medium" | "high",
          project_id: selectedProjectId,
          due_date: taskStart.split('T')[0],
          start_at: taskStart,
          end_at: taskEnd,
          assignee_id: undefined,
          recurrence_rule: recurrence === "Does not repeat" ? undefined : recurrence
        })
      } else if (type === 'project') {
        addProject({
          name: finalTitle,
          description,
          status: 'on-track',
          color: 'bg-stone-900',
          is_favorite: false,
        })
      } else if (type === 'note') {
        const plainText = description || ""
        addNote({
          title: finalTitle,
          content: createNoteContentFromText(plainText),
          excerpt: buildExcerpt(plainText),
          body: plainText || null,
          tags: ["quick"],
          pinned: false,
          hlc_timestamp: `${Date.now()}:0:web`,
          is_deleted: false,
        })
      } else if (type === 'event') {
        addEvent({
          title: finalTitle,
          description,
          start_date: dueDate.toISOString(),
          end_date: new Date(dueDate.getTime() + 3600000).toISOString(),
          color: 'rgb(59, 130, 246)',
        })
      }
    }

    setOpen(false)
    if (!editItem) {
      setTitle("")
      setDescription("")
      setPriority("Medium")
      setDueDate(new Date())
      setSelectedProjectId(undefined)
      setAllDay(false)
      setStartTime("09:00")
      setEndTime("10:00")
      setReminder("None")
    }
  }

  const types = [
    { id: 'event', label: 'Event' },
    { id: 'task', label: 'Task' },
  ]

  const defaultTrigger = (
    <Button 
      size="sm" 
      className="bg-blue-600 text-white hover:bg-blue-500 gap-2 h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-[0_8px_16px_rgba(37,99,235,0.2)] hover:shadow-[0_8px_20px_rgba(37,99,235,0.3)] active:scale-95 transition-all duration-300"
    >
      <Plus className="w-4 h-4" />
      Quick Create
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger
          render={trigger || defaultTrigger}
          nativeButton={true}
        />
      )}
      
      <AnimatePresence>
        {open && (
          <DialogContent 
            showCloseButton={false}
            className="sm:max-w-[420px] p-0 border-none bg-[#1f1f1f] shadow-[0_24px_38px_3px_rgba(0,0,0,0.14),0_9px_46px_8px_rgba(0,0,0,0.12),0_11px_15px_-7px_rgba(0,0,0,0.2)] rounded-[24px] outline-none overflow-hidden"
          >
            <div className="flex flex-col h-full min-h-[480px] bg-[#1f1f1f] text-[#e3e3e3] font-sans">
              {/* Type Switcher */}
              <div className="px-6 pt-5 pb-2 flex items-center justify-end border-b border-white/10">
                <div className="flex gap-4">
                  {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id as 'task' | 'project' | 'note' | 'event')}
                    className={cn(
                      "text-sm font-medium transition-colors pb-1",
                      type === t.id 
                        ? "text-[#e3e3e3]" 
                        : "text-[#8e918f] hover:text-[#c4c7c5]"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
                </div>
              </div>

              {/* Header / Title Row */}
              <div className="flex items-center px-6 pt-4 pb-2 gap-3">
                <div className="flex-1">
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={type === 'task' ? "Task Title" : "Event Title"}
                    className="w-full bg-transparent border-none py-1 text-3xl font-bold placeholder:text-[#5f6368] focus:outline-none transition-colors text-[#e3e3e3]"
                  />
                </div>
              </div>

              <div className="flex flex-col px-6 pb-2 gap-3 mt-1">
                {/* Details/Notes Row */}
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <AlignLeft className="w-5 h-5 text-[#8e918f]" />
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Details/Notes"
                      className="w-full bg-transparent border-none p-0 mt-0.5 text-sm min-h-[40px] placeholder:text-[#5f6368] focus:outline-none transition-all resize-none text-[#e3e3e3]"
                    />
                  </div>
                </div>

                {/* All Day Row */}
                <div className="flex items-center gap-4">
                  <div>
                    <CalendarIcon className="w-5 h-5 text-[#8e918f]" />
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm font-medium text-[#e3e3e3]">All Day</span>
                    {/* Toggle Switch */}
                    <button 
                      type="button" 
                      onClick={() => setAllDay(!allDay)}
                      className={cn("w-8 h-4 rounded-full relative transition-colors", allDay ? "bg-blue-500" : "bg-[#3c4043]")}
                    >
                      <div className={cn("absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all", allDay ? "left-[18px]" : "left-[2px]")} />
                    </button>
                  </div>
                </div>

                {/* Date / Time Row */}
                {!allDay && (
                  <div className="flex items-center gap-4">
                    <div>
                      <Clock className="w-5 h-5 text-[#8e918f]" />
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-[1.5]">
                        <input 
                          type="date"
                          value={!isNaN(dueDate.getTime()) ? dueDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                          onChange={(e) => {
                            if (e.target.value) {
                              const newDate = new Date(e.target.value + 'T00:00:00');
                              if (!isNaN(newDate.getTime())) {
                                setDueDate(newDate);
                              }
                            } else {
                              setDueDate(new Date());
                            }
                          }}
                          className="w-full bg-[#323639] hover:bg-[#3c4043] border-none rounded focus:outline-none cursor-pointer px-3 py-1.5 text-[13px] font-medium text-[#e3e3e3] [color-scheme:dark] transition-colors text-center"
                        />
                      </div>
                      <div className="flex-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="w-full bg-[#323639] hover:bg-[#3c4043] border-none rounded focus:outline-none focus:ring-1 focus:ring-[#1A73E8] cursor-pointer px-3 py-1.5 text-[13px] font-medium text-[#e3e3e3] transition-colors text-center outline-none">
                            {timeOptions.find(opt => opt.value === startTime)?.label}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="center" 
                            side="bottom" 
                            className="bg-[#2d2e30] border border-[#3c4043] text-[#e3e3e3] max-h-[220px] overflow-y-auto min-w-[100px] p-0 custom-scrollbar"
                          >
                            {timeOptions.map((opt) => (
                              <DropdownMenuItem 
                                key={`start-${opt.value}`} 
                                onClick={() => setStartTime(opt.value)}
                                className={cn("text-[13px] font-medium justify-center focus:bg-[#3c4043] focus:text-[#e3e3e3] cursor-pointer py-2 rounded-none", startTime === opt.value && "bg-[#1A73E8]/20 text-[#1A73E8] focus:bg-[#1A73E8]/30 focus:text-[#1A73E8]")}
                              >
                                {opt.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <span className="text-[#5f6368] font-medium">-</span>
                      <div className="flex-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="w-full bg-[#323639] hover:bg-[#3c4043] border-none rounded focus:outline-none focus:ring-1 focus:ring-[#1A73E8] cursor-pointer px-3 py-1.5 text-[13px] font-medium text-[#e3e3e3] transition-colors text-center outline-none">
                            {timeOptions.find(opt => opt.value === endTime)?.label}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="center" 
                            side="bottom" 
                            className="bg-[#2d2e30] border border-[#3c4043] text-[#e3e3e3] max-h-[220px] overflow-y-auto min-w-[100px] p-0 custom-scrollbar"
                          >
                            {timeOptions.map((opt) => (
                              <DropdownMenuItem 
                                key={`end-${opt.value}`} 
                                onClick={() => setEndTime(opt.value)}
                                className={cn("text-[13px] font-medium justify-center focus:bg-[#3c4043] focus:text-[#e3e3e3] cursor-pointer py-2 rounded-none", endTime === opt.value && "bg-[#1A73E8]/20 text-[#1A73E8] focus:bg-[#1A73E8]/30 focus:text-[#1A73E8]")}
                              >
                                {opt.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Row */}
                <div className="flex items-center gap-4">
                  <div>
                    <List className="w-5 h-5 text-[#8e918f]" />
                  </div>
                  <div className="flex-1">
                    <div className="relative flex justify-between items-center w-full group">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-500 pointer-events-none z-0" />
                      <select
                        value={selectedProjectId || ""}
                        onChange={(e) => setSelectedProjectId(e.target.value || undefined)}
                        className="appearance-none bg-transparent border-none focus:outline-none cursor-pointer text-sm font-medium text-[#e3e3e3] w-full pl-5 pr-8 py-2 relative z-10"
                      >
                        <option value="" className="bg-[#1f1f1f]">Inbox</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id} className="bg-[#1f1f1f]">{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[#8e918f] absolute right-0 pointer-events-none group-hover:text-[#e3e3e3] transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Repeat Row */}
                <div className="flex items-center gap-4">
                  <div>
                    <Repeat className="w-5 h-5 text-[#8e918f]" />
                  </div>
                  <div className="flex-1">
                    <button type="button" onClick={() => setRecurrenceModalOpen(true)} className="w-full flex justify-between items-center text-sm font-medium text-[#e3e3e3] py-2 group">
                      <span>{recurrence === "Does not repeat" ? "Does not repeat" : recurrence}</span>
                      <ChevronDown className="w-4 h-4 text-[#8e918f] group-hover:text-[#e3e3e3] transition-colors" />
                    </button>
                  </div>
                </div>

                {/* Reminder Row */}
                <div className="flex items-center gap-4">
                  <div>
                    <Bell className="w-5 h-5 text-[#8e918f]" />
                  </div>
                  <div className="flex-1">
                    <div className="relative flex justify-between items-center w-full group">
                      <select
                        value={reminder}
                        onChange={(e) => setReminder(e.target.value)}
                        className="appearance-none bg-transparent border-none focus:outline-none cursor-pointer text-sm font-medium text-[#e3e3e3] w-full pr-8 py-2 relative z-10"
                      >
                        <option value="None" className="bg-[#1f1f1f]">No Reminder</option>
                        <option value="5 minutes before" className="bg-[#1f1f1f]">5 minutes before</option>
                        <option value="10 minutes before" className="bg-[#1f1f1f]">10 minutes before</option>
                        <option value="30 minutes before" className="bg-[#1f1f1f]">30 minutes before</option>
                        <option value="1 hour before" className="bg-[#1f1f1f]">1 hour before</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-[#8e918f] absolute right-0 pointer-events-none group-hover:text-[#e3e3e3] transition-colors" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="py-3 px-6 border-t border-white/5 flex items-center justify-end gap-3 mt-auto mb-0">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 font-medium text-sm text-[#8e918f] hover:text-[#e3e3e3] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-1.5 rounded font-medium text-sm shadow-sm transition-all bg-[#1A73E8] text-white hover:opacity-90 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </DialogContent>
        )}
      </AnimatePresence>
      <RecurrenceModal 
        open={recurrenceModalOpen}
        onOpenChange={setRecurrenceModalOpen}
        baseDate={dueDate}
        onSave={(config) => {
          const dayNames = config.days.map(d => d.split('-')[0]).join(', ')
          setRecurrence(`Weekly on ${dayNames}`)
        }}
      />
    </Dialog>
  )
}

