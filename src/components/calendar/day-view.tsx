"use client"

import { useMemo, useState, useEffect } from "react"
import { 
  CheckSquare,
  Clock,
  MapPin,
  AlignLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Task, CalendarEvent } from "@/shared"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { 
  isSameDay,
  format,
} from "date-fns"
import { TimeGrid } from "./time-grid"

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
  onItemClick: (item: (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' })) => void
}

export function DayView({ currentDate, events, tasks, onItemClick }: DayViewProps) {
  const HOUR_HEIGHT = 48
  const getTaskStart = (task: Task) => task.start_at || task.due_date

  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const frame = setTimeout(() => setMounted(true), 0)
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => {
      clearTimeout(frame)
      clearInterval(timer)
    }
  }, [])

  const currentTimeTop = useMemo(() => {
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    return (minutesSinceMidnight / 60) * HOUR_HEIGHT
  }, [now])

  const items = useMemo(() => {
    const dayEvents = events.filter(event => isSameDay(new Date(event.start_date), currentDate) && !event.deleted_at)
    const dayTasks = tasks.filter(task => {
      const start = getTaskStart(task)
      return start && isSameDay(new Date(start), currentDate) && !task.deleted_at
    })
    
    return [
      ...dayEvents.map(e => ({ ...e, type: 'event' as const })),
      ...dayTasks.map(t => ({ ...t, type: 'task' as const }))
    ]
  }, [currentDate, events, tasks])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Grid */}
      <TimeGrid hourHeight={HOUR_HEIGHT}>
        <div className="flex-1 relative bg-transparent">
          {/* Grid interactive slots */}
          <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col pointer-events-none">
            {Array.from({ length: 24 }).map((_, hour) => {
              const slotDate = new Date(currentDate)
              slotDate.setHours(hour, 0, 0, 0)
              return (
                <QuickCreateModal
                  key={hour}
                  defaultType="task"
                  defaultDate={slotDate}
                  trigger={
                    <button 
                      type="button"
                      className="w-full hover:bg-white/[0.02] transition-colors cursor-pointer pointer-events-auto border-none bg-transparent block p-0"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    />
                  }
                />
              )
            })}
          </div>

          {/* Current time indicator */}
          {mounted && isSameDay(currentDate, new Date()) && (
            <div 
              className="absolute left-0 right-0 h-px bg-[#ef4444] z-40 pointer-events-none flex items-center"
              style={{ top: `${currentTimeTop}px` }}
            >
              <div className="w-2 h-2 rounded-full bg-[#ef4444] -ml-1" />
            </div>
          )}

          {items.map((item) => {
            const start = item.type === 'event'
              ? new Date(item.start_date)
              : new Date(item.start_at || item.due_date!)
            const end = item.type === 'event'
              ? new Date(item.end_date)
              : new Date(item.end_at || new Date(start.getTime() + 30 * 60000))
            
            const startMinutes = start.getHours() * 60 + start.getMinutes()
            const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000)
            
            const top = (startMinutes / 60) * HOUR_HEIGHT
            const height = (durationMinutes / 60) * HOUR_HEIGHT

            return (
              <div 
                key={item.id}
                onClick={() => onItemClick(item)}
                className={cn(
                  "absolute left-4 right-8 rounded-xl border-l-[4px] p-6 overflow-hidden z-10 transition-all hover:z-20 cursor-pointer group/event shadow-2xl",
                  item.type === 'event' 
                    ? "bg-[#4285F4]/5 border-[#4285F4] hover:bg-[#4285F4]/10" 
                    : "bg-[#039BE5]/5 border-[#039BE5] hover:bg-[#039BE5]/10"
                )}
                style={{ 
                  top: `${top}px`, 
                  height: `${height}px`,
                }}
              >
                <div className="flex flex-col gap-4 h-full overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {item.type === 'task' && <CheckSquare className="w-6 h-6 text-[#039BE5] mt-0.5 shrink-0" />}
                      <div className="flex flex-col gap-1.5">
                        <span className={cn(
                          "text-xl font-bold tracking-tight leading-tight uppercase",
                          item.type === 'event' ? "text-[#4285F4]" : "text-[#039BE5]"
                        )}>
                          {item.title}
                        </span>
                        <div className="flex items-center gap-2.5 text-stone-500 font-bold text-[12px] uppercase tracking-wider">
                          <Clock className="w-4 h-4" />
                          <span>
                            {format(start, 'h:mm a')} â€“ {format(end, 'h:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {durationMinutes >= 60 && item.description && (
                    <div className="flex items-start gap-3 pt-3 border-t border-white/5 opacity-70 group-hover:opacity-100 transition-opacity">
                      <AlignLeft className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                      <p className="text-[13px] text-stone-400 line-clamp-3 leading-relaxed font-medium">
                        {item.description}
                      </p>
                    </div>
                  )}

                  {durationMinutes >= 90 && item.type === 'event' && item.location && (
                    <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                      <MapPin className="w-4 h-4 text-stone-600 shrink-0" />
                      <span className="text-[13px] text-stone-400 truncate font-medium">
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
