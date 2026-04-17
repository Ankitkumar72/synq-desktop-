"use client"

import { useMemo } from "react"
import { 
  CheckSquare,
  Clock,
  MapPin,
  AlignLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Task, CalendarEvent } from "@/types"
import { 
  isSameDay,
  format,
} from "date-fns"
import { TimeGrid } from "./time-grid"

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
}

export function DayView({ currentDate, events, tasks }: DayViewProps) {
  const HOUR_HEIGHT = 80

  const items = useMemo(() => {
    const dayEvents = events.filter(event => isSameDay(new Date(event.start_date), currentDate) && !event.deleted_at)
    const dayTasks = tasks.filter(task => task.due_date && isSameDay(new Date(task.due_date), currentDate) && !task.deleted_at)
    
    return [
      ...dayEvents.map(e => ({ ...e, type: 'event' as const })),
      ...dayTasks.map(t => ({ ...t, type: 'task' as const }))
    ]
  }, [currentDate, events, tasks])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-white/5 bg-[#0e0e0e]/50 backdrop-blur-md">
        <div className="w-16 border-r border-white/5 shrink-0" />
        <div className="flex-1 px-8 py-6 flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
            {format(currentDate, 'EEEE')}
          </span>
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {format(currentDate, 'MMMM d, yyyy')}
            </h2>
            {isSameDay(currentDate, new Date()) && (
              <span className="bg-blue-600/20 text-blue-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                Today
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <TimeGrid>
        <div className="flex-1 relative bg-transparent">
          {items.map((item) => {
            const start = item.type === 'event' ? new Date(item.start_date) : new Date(item.due_date!)
            const end = item.type === 'event' ? new Date(item.end_date) : new Date(new Date(item.due_date!).getTime() + 30 * 60000)
            
            const startMinutes = start.getHours() * 60 + start.getMinutes()
            const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000)
            
            const top = (startMinutes / 60) * HOUR_HEIGHT
            const height = (durationMinutes / 60) * HOUR_HEIGHT

            return (
              <div 
                key={item.id}
                className={cn(
                  "absolute left-4 right-8 rounded-2xl border p-5 overflow-hidden backdrop-blur-xl z-10 transition-all hover:z-20 cursor-pointer group/event shadow-xl",
                  item.type === 'event' 
                    ? "bg-white/[0.03] border-white/10 hover:bg-white/10" 
                    : "bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10"
                )}
                style={{ 
                  top: `${top}px`, 
                  height: `${height}px`,
                }}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5 rounded-full opacity-70 group-hover/event:opacity-100 transition-opacity"
                  style={{ 
                    backgroundColor: item.type === 'event' 
                      ? (item.color?.startsWith('bg-') ? undefined : item.color)
                      : '#3B82F6' 
                  }}
                />
                <div className="flex flex-col gap-3 h-full overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {item.type === 'task' && <CheckSquare className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />}
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "text-base font-bold tracking-tight leading-tight",
                          item.type === 'event' ? "text-stone-100" : "text-blue-100"
                        )}>
                          {item.title}
                        </span>
                        <div className="flex items-center gap-2 text-stone-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold uppercase tracking-tight">
                            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {durationMinutes >= 60 && item.description && (
                    <div className="flex items-start gap-2 pt-1 border-t border-white/5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <AlignLeft className="w-3.5 h-3.5 text-stone-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-stone-400 line-clamp-2 leading-normal">
                        {item.description}
                      </p>
                    </div>
                  )}

                  {durationMinutes >= 90 && item.type === 'event' && item.location && (
                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <MapPin className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                      <span className="text-[11px] text-stone-400 truncate">
                        {item.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </TimeGrid>
    </div>
  )
}
