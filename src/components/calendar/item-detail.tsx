"use client"

import { 
  X, 
  Pencil, 
  Trash2, 
  AlignLeft, 
  MapPin, 
  Layout
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Task, CalendarEvent } from "@/types"
import { format, isSameDay } from "date-fns"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { useProjectStore } from "@/lib/store/use-project-store"

interface ItemDetailProps {
  item: (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (item: (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' })) => void
}

export function ItemDetail({ item, open, onOpenChange, onEdit }: ItemDetailProps) {
  const { updateTask, deleteTask } = useTaskStore()
  const { deleteEvent } = useEventStore()
  const { projects } = useProjectStore()

  if (!item) return null

  const isTask = item.type === 'task'
  const isEvent = item.type === 'event'
  
  const startDate = isEvent ? new Date(item.start_date) : new Date(item.due_date!)
  const endDate = isEvent ? new Date(item.end_date) : null
  const isCompleted = isTask && item.status === 'done'
  
  const project = isTask && item.project_id ? projects.find(p => p.id === item.project_id) : null

  const handleDelete = () => {
    if (isTask) {
      deleteTask(item.id)
    } else {
      deleteEvent(item.id)
    }
    onOpenChange(false)
  }

  const toggleTaskStatus = () => {
    if (isTask) {
      updateTask(item.id, { 
        status: isCompleted ? 'todo' : 'done' 
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[448px] p-0 border-none bg-[#1f1f1f] text-[#e3e3e3] shadow-2xl rounded-[28px] outline-none overflow-hidden">
        {/* Header Actions */}
        <div className="flex items-center justify-end p-2 gap-1 pr-3 pt-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-[#c4c7c5] hover:bg-white/10" onClick={() => onEdit?.(item)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-[#c4c7c5] hover:bg-white/10" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-[#c4c7c5] hover:bg-white/10" onClick={() => onOpenChange(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Title and Color Indicator */}
          <div className="flex gap-4 items-start">
            <div className="mt-1.5 shrink-0">
              <div 
                className="w-4 h-4 rounded-sm" 
                style={{ backgroundColor: isTask ? '#039BE5' : (item.color || '#4285F4') }}
              />
            </div>
            <div className="flex-1">
              <h2 className={cn(
                "text-2xl font-normal leading-tight tracking-tight",
                isCompleted && "line-through text-[#8e918f]"
              )}>
                {item.title}
              </h2>
              
              <div className="mt-2 space-y-1">
                <div className="text-sm font-medium text-[#e3e3e3]">
                  {format(startDate, 'EEEE, MMMM d')}
                  {isEvent && endDate && !isSameDay(startDate, endDate) && ` – ${format(endDate, 'EEEE, MMMM d')}`}
                </div>
                <div className="text-sm text-[#c4c7c5]">
                  {format(startDate, 'h:mma').toLowerCase()}
                  {isEvent && endDate && ` – ${format(endDate, 'h:mma').toLowerCase()}`}
                </div>
              </div>
            </div>
          </div>

          {/* Details Rows */}
          <div className="space-y-4 ml-8">
            {/* Recurrence (Mockup for now as per image) */}
            {isTask && item.recurrence_rule && (
              <div className="flex items-center gap-4 text-sm text-[#c4c7c5]">
                <span className="font-medium text-[#e3e3e3]">{item.recurrence_rule}</span>
              </div>
            )}

            {isCompleted && item.updated_at && (
              <div className="text-sm text-[#c4c7c5]">
                Completed: {format(new Date(item.updated_at), 'EEEE, MMMM d')}
              </div>
            )}

            {/* Project */}
            <div className="flex items-center gap-4 text-sm">
              <Layout className="w-5 h-5 text-[#c4c7c5]" />
              <span className={cn(
                "font-medium cursor-pointer hover:underline",
                project ? "text-white" : "text-[#8ab4f8]"
              )}>
                {project ? project.name : (isTask ? 'Tasks' : 'Calendar')}
              </span>
            </div>

            {/* Description */}
            {item.description && (
              <div className="flex items-start gap-4 text-sm">
                <AlignLeft className="w-5 h-5 text-[#c4c7c5] mt-0.5" />
                <p className="text-[#e3e3e3] leading-relaxed whitespace-pre-wrap">{item.description}</p>
              </div>
            )}

            {/* Location */}
            {isEvent && item.location && (
              <div className="flex items-center gap-4 text-sm">
                <MapPin className="w-5 h-5 text-[#c4c7c5]" />
                <span className="text-[#8ab4f8] font-medium cursor-pointer hover:underline">{item.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        {isTask && (
          <div className="px-6 py-4 bg-transparent flex justify-end border-t border-white/5">
            <Button 
              onClick={toggleTaskStatus}
              className={cn(
                "rounded-full px-6 font-bold text-sm h-10 transition-all",
                isCompleted 
                  ? "bg-[#0b57d0] text-white hover:bg-[#0b57d0]/90" 
                  : "bg-[#8ab4f8] text-[#041e49] hover:bg-[#8ab4f8]/90"
              )}
            >
              {isCompleted ? "Mark uncompleted" : "Mark completed"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
