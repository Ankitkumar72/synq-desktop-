"use client"

import { useState } from "react"
import { 
  Plus,
  Clock,
  AlignLeft,
  Target,
  MoreVertical
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useProjectStore } from "@/lib/store/use-project-store"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { AnimatePresence } from "framer-motion"
import { useUserStore } from "@/lib/store/use-user-store"
import { RecurrenceModal } from "./recurrence-modal"

export function QuickCreateModal({ 
  trigger, 
  defaultType = 'task',
  defaultDate = new Date()
}: { 
  trigger?: React.ReactElement, 
  defaultType?: 'task' | 'project' | 'note' | 'event',
  defaultDate?: Date 
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'task' | 'project' | 'note' | 'event'>(defaultType)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [dueDate, setDueDate] = useState<Date>(defaultDate)
  const [recurrence, setRecurrence] = useState("Does not repeat")
  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)

  const { addTask } = useTaskStore()
  const { addProject, projects } = useProjectStore()
  const { addNote } = useNotesStore()
  const { addEvent } = useEventStore()

  const handleCreate = () => {
    if (!title) return

    if (type === 'task') {
      addTask({
        title,
        status: 'todo',
        priority: priority.toLowerCase() as "low" | "medium" | "high",
        project_id: selectedProjectId,
        due_date: dueDate.toISOString(),
        assignee_id: undefined,
      })
    } else if (type === 'project') {
      addProject({
        name: title,
        description,
        status: 'on-track',
        color: 'bg-stone-900',
        is_favorite: false,
      })
    } else if (type === 'note') {
      addNote({
        title,
        content: description || "No content yet...",
        excerpt: (description || "No content yet...").substring(0, 100),
        body: description || "No content yet...",
        tags: ["quick"],
        pinned: false,
        is_task: false,
        is_completed: false,
        subtasks: [],
        hlc_timestamp: `${Date.now()}:0:web`,
        is_deleted: false,
      })
    } else if (type === 'event') {
      addEvent({
        title,
        description,
        start_date: dueDate.toISOString(),
        end_date: new Date(dueDate.getTime() + 3600000).toISOString(),
        color: 'rgb(59, 130, 246)',
      })
    }

    setOpen(false)
    setTitle("")
    setDescription("")
    setPriority("Medium")
    setDueDate(new Date())
    setSelectedProjectId(undefined)
  }

  const types = [
    { id: 'event', label: 'Event' },
    { id: 'task', label: 'Task' },
    { id: 'appointment', label: 'Appointment schedule', new: true },
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
      <DialogTrigger
        render={trigger || defaultTrigger}
      />
      
      <AnimatePresence>
        {open && (
          <DialogContent 
            className="sm:max-w-[500px] p-0 border-none bg-[#1f1f1f] shadow-[0_24px_38px_3px_rgba(0,0,0,0.14),0_9px_46px_8px_rgba(0,0,0,0.12),0_11px_15px_-7px_rgba(0,0,0,0.2)] rounded-[32px] outline-none overflow-hidden"
          >
            <div className="flex flex-col h-full bg-[#1f1f1f] text-[#e3e3e3] font-sans">
              {/* Header / Title Row */}
              <div className="flex items-center justify-between p-2 pl-8 pt-4 pr-12">
                <div className="flex-1">
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Add title"
                    className="w-full bg-transparent border-b-2 border-transparent focus:border-blue-500 py-3 text-3xl font-normal placeholder:text-[#8e918f] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Type Switcher */}
              <div className="px-8 pb-4 flex gap-2">
                {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id !== 'appointment') setType(t.id as 'task' | 'project' | 'note' | 'event')
                    }}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                      type === t.id 
                        ? "bg-[#0b57d0] text-white" 
                        : "hover:bg-white/10 text-[#c4c7c5]"
                    )}
                  >
                    {t.label}
                    {t.new && (
                      <span className="text-[10px] bg-[#d3e3fd] text-[#041e49] px-1.5 py-0.5 rounded-md font-bold uppercase">New</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="px-8 pb-8 space-y-6">
                {/* Row: Date/Time */}
                <div className="flex gap-6 items-start group">
                  <div className="pt-2 text-[#c4c7c5]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-4 text-sm font-medium hover:bg-white/5 p-2 -ml-2 rounded-lg cursor-pointer transition-colors">
                      <span className="text-[#e3e3e3]">
                        {dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      <span className="text-[#e3e3e3]">
                        {dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()} — {new Date(dueDate.getTime() + 3600000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}
                      </span>
                    </div>
                    <button 
                      onClick={() => setRecurrenceModalOpen(true)}
                      className="text-xs font-medium text-[#c4c7c5] hover:bg-white/5 px-2 py-1 -ml-1 rounded-md transition-colors"
                    >
                      {recurrence}
                    </button>
                  </div>
                </div>

                {/* Row: Target/Deadline (Tasks Only) */}
                {type === 'task' && (
                  <div className="flex gap-6 items-center group">
                    <div className="text-[#c4c7c5]">
                      <Target className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <button className="text-sm font-medium text-[#c4c7c5] hover:bg-white/5 p-2 -ml-2 w-full text-left rounded-lg transition-colors">
                        Add deadline
                      </button>
                    </div>
                  </div>
                )}

                {/* Row: Description */}
                <div className="flex gap-6 items-start group">
                  <div className="pt-2 text-[#c4c7c5]">
                    <AlignLeft className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add description"
                      className="w-full bg-[#1a1c1e] hover:bg-[#25282a] focus:bg-[#323537] rounded-xl border-none p-4 text-sm min-h-[120px] placeholder:text-[#8e918f] focus:outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Row: Project/Calendar Selection */}
                <div className="flex gap-6 items-center group">
                  <div className="text-[#c4c7c5]">
                    <MoreVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="bg-[#323537] hover:bg-[#3c3f41] rounded-lg h-10 px-4 text-sm font-medium focus:outline-none transition-colors appearance-none cursor-pointer pr-10 relative"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238e918f'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row: Profile/Visibility */}
                <div className="flex gap-6 items-center group">
                  <div className="text-[#c4c7c5]">
                    <div className="w-5 h-5 rounded-full bg-[#4285f4] flex items-center justify-center text-[8px] font-bold text-white uppercase">
                      {useUserStore.getState().user?.email?.[0] || 'U'}
                    </div>
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2 font-medium text-[#e3e3e3]">
                      <span>{useUserStore.getState().user?.user_metadata?.full_name || useUserStore.getState().user?.email?.split('@')[0] || "User"}</span>
                    </div>
                    <div className="text-xs text-[#8e918f]">Personal • Private</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-transparent flex items-center justify-end">
                <button
                  onClick={handleCreate}
                  disabled={!title}
                  className={cn(
                    "h-10 px-8 rounded-full font-bold text-sm shadow-sm transition-all",
                    title 
                      ? "bg-[#a8c7fa] text-[#041e49] hover:bg-[#b0d1ff]" 
                      : "bg-[#3c4043] text-[#70757a] cursor-not-allowed"
                  )}
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
          // Format recurrence string
          const dayNames = config.days.map(d => d.split('-')[0]).join(', ')
          setRecurrence(`Weekly on ${dayNames}`)
        }}
      />
    </Dialog>
  )
}
