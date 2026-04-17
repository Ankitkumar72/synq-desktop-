"use client"

import { useMemo } from "react"
import { 
  CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Task, CalendarEvent } from "@/types"
import { 
  startOfWeek, 
  addDays, 
  eachDayOfInterval, 
  format,
  isSameDay,
} from "date-fns"
import { TimeGrid } from "./time-grid"

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
}

export function WeekView({ currentDate, events, tasks }: WeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate)
    return eachDayOfInterval({ start, end: addDays(start, 6) })
  }, [currentDate])

  const HOUR_HEIGHT = 80

  const getDayItems = (date: Date) => {
    const dayEvents = events.filter(event => isSameDay(new Date(event.start_date), date) && !event.deleted_at)
    const dayTasks = tasks.filter(task => task.due_date && isSameDay(new Date(task.due_date), date) && !task.deleted_at)
    
    return [
      ...dayEvents.map(e => ({ ...e, type: 'event' as const })),
      ...dayTasks.map(t => ({ ...t, type: 'task' as const }))
    ]
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-white/5 bg-[#0e0e0e]/50 backdrop-blur-md">
        <div className="w-16 border-r border-white/5 shrink-0" />
        <div className="flex-1 flex">
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, new Date())
            return (
              <div key={i} className="flex-1 py-4 flex flex-col items-center gap-1 border-r border-white/5 last:border-r-0">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  isToday ? "text-blue-400" : "text-stone-500"
                )}>
                  {format(day, 'EEE')}
                </span>
                <span className={cn(
                  "w-9 h-9 flex items-center justify-center text-lg font-bold rounded-xl transition-all",
                  isToday ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "text-stone-200"
                )}>
                  {format(day, 'd')}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <TimeGrid>
        {weekDays.map((day, i) => (
          <div key={i} className="flex-1 relative border-r border-white/[0.03] last:border-r-0 bg-transparent">
            {getDayItems(day).map((item) => {
              const start = item.type === 'event' ? new Date(item.start_date) : new Date(item.due_date!)
              const end = item.type === 'event' ? new Date(item.end_date) : new Date(new Date(item.due_date!).getTime() + 30 * 60000) // Default 30 min for tasks
              
              const startMinutes = start.getHours() * 60 + start.getMinutes()
              const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000)
              
              const top = (startMinutes / 60) * HOUR_HEIGHT
              const height = (durationMinutes / 60) * HOUR_HEIGHT

              return (
                <div 
                  key={item.id}
                  className={cn(
                    "absolute left-1 right-1 rounded-lg border p-1.5 overflow-hidden backdrop-blur-md z-10 transition-all hover:z-20 cursor-pointer group/event",
                    item.type === 'event' 
                      ? "bg-white/[0.05] border-white/10 hover:bg-white/10 shadow-lg" 
                      : "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20"
                  )}
                  style={{ 
                    top: `${top}px`, 
                    height: `${height}px`,
                  }}
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-full opacity-70 group-hover/event:opacity-100 transition-opacity"
                    style={{ 
                      backgroundColor: item.type === 'event' 
                        ? (item.color?.startsWith('bg-') ? undefined : item.color)
                        : '#3B82F6' 
                    }}
                  />
                  <div className="flex flex-col gap-0.5 h-full">
                    <div className="flex items-start gap-1.5">
                      {item.type === 'task' && <CheckSquare className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />}
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-tight leading-tight line-clamp-2",
                        item.type === 'event' ? "text-stone-100" : "text-blue-100"
                      )}>
                        {item.title}
                      </span>
                    </div>
                    {durationMinutes >= 45 && (
                      <span className="text-[9px] font-bold text-stone-500 uppercase tracking-tighter">
                        {format(start, 'h:mm a')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </TimeGrid>
    </div>
  )
}
