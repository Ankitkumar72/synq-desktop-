"use client"

import { useState } from "react"
import { 
  Plus, 
  CheckSquare, 
  FolderKanban, 
  StickyNote, 
  Calendar
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useProjectStore } from "@/lib/store/use-project-store"
import { useNotesStore } from "@/lib/store/use-notes-store"

export function QuickCreateModal({ trigger }: { trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'task' | 'project' | 'note'>('task')
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [due, setDue] = useState("Today")

  const { addTask } = useTaskStore()
  const { addProject } = useProjectStore()
  const { addNote } = useNotesStore()

  const handleCreate = () => {
    if (!title) return

    if (type === 'task') {
      addTask({
        title,
        status: 'todo',
        priority: priority.toLowerCase() as "low" | "medium" | "high",
        project_id: undefined,
        due_date: due,
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
        tags: ["quick"],
        pinned: false,
      })
    }

    setOpen(false)
    setTitle("")
    setDescription("")
    setPriority("Medium")
    setDue("Today")
  }

  const types = [
    { id: 'task', label: 'Task', icon: CheckSquare, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'project', label: 'Project', icon: FolderKanban, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'note', label: 'Note', icon: StickyNote, color: 'text-amber-500', bg: 'bg-amber-50' },
  ]

  const defaultTrigger = (
    <Button size="sm" className="bg-black text-white hover:bg-stone-800 gap-2 h-9 px-4 rounded-full font-medium">
      <Plus className="w-4 h-4" />
      Quick Create
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger || defaultTrigger} />
      
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-stone-100 shadow-2xl rounded-2xl">
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="text-xl font-black tracking-tight text-black">Quick Create</DialogTitle>
        </DialogHeader>
        
        <div className="p-8 space-y-6">
          <div className="flex gap-3">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id as 'task' | 'project' | 'note')}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                  type === t.id 
                    ? "border-black bg-stone-50" 
                    : "border-stone-50 bg-white hover:bg-stone-50"
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", t.bg, t.color)}>
                  <t.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">Title</label>
              <Input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Enter ${type} title...`} 
                className="h-12 border-stone-100 focus-visible:ring-black bg-stone-50/50 rounded-xl font-bold placeholder:text-stone-300 transition-all focus-visible:bg-white"
              />
            </div>

            {type === 'task' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">Priority</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="flex h-12 w-full rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">Due Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                    <Input 
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                      className="pl-12 h-12 border-stone-100 focus-visible:ring-black bg-stone-50/50 rounded-xl font-bold text-stone-900 focus-visible:bg-white" 
                      placeholder="Today" 
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">Description / Content</label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] rounded-xl border-stone-100 focus-visible:ring-black resize-none bg-stone-50/50 font-medium p-4 focus-visible:bg-white transition-all overflow-hidden"
                placeholder="Add some more context..."
              />
            </div>
          </div>
        </div>

        <div className="p-8 bg-stone-50 flex items-center justify-end gap-3 border-t border-stone-100">
          <Button variant="ghost" onClick={() => setOpen(false)} className="text-stone-400 font-black text-[10px] uppercase tracking-widest h-11 px-8 rounded-xl hover:text-black">
            Dismiss
          </Button>
          <Button 
            onClick={handleCreate}
            className="bg-black text-white hover:bg-stone-800 h-11 px-10 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-black/20 active:scale-95 transition-all"
          >
            Create {type}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
