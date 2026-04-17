"use client"

import { useMemo, useState, useEffect } from "react"
import { 
  CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Task, CalendarEvent } from "@/types"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { 
  startOfWeek, 
  addDays, 
  eachDayOfInterval, 
  format,
  isSameDay,
  startOfDay,
  endOfDay,
} from "date-fns"
import { TimeGrid } from "./time-grid"

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
}

const isAllDayEvent = (event: CalendarEvent) => {
  const start = new Date(event.start_date)
  const end = new Date(event.end_date)
  return (end.getTime() - start.getTime()) >= 24 * 60 * 60 * 1000
}

export function WeekView({ currentDate, events, tasks }: WeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate)
    return eachDayOfInterval({ start, end: addDays(start, 6) })
  }, [currentDate])

  const HOUR_HEIGHT = 80
  
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

  const timezoneOffset = useMemo(() => {
    const offset = new Date().getTimezoneOffset()
    const sign = offset > 0 ? '-' : '+'
    const absOffset = Math.abs(offset)
    const hours = Math.floor(absOffset / 60)
    const minutes = absOffset % 60
    return `GMT${sign}${hours}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''}`
  }, [])

  const getAllDayItems = (date: Date) => {
    // An event is in this day's all-day slot if it's considered an all-day event
    // and the current 'date' falls within its start/end interval.
    const dayEvents = events.filter(event => {
      if (event.deleted_at || !isAllDayEvent(event)) return false
      const eventStart = startOfDay(new Date(event.start_date))
      const eventEnd = endOfDay(new Date(event.end_date))
      return date.getTime() >= eventStart.getTime() && date.getTime() <= eventEnd.getTime()
    })
    
    return dayEvents
  }

  const getGridItems = (date: Date) => {
    // Regular time-bound events that start on this specific day
    const dayEvents = events.filter(event => 
      isSameDay(new Date(event.start_date), date) && !event.deleted_at && !isAllDayEvent(event)
    )
    const dayTasks = tasks.filter(task => 
      task.due_date && isSameDay(new Date(task.due_date), date) && !task.deleted_at
    )
    
    return [
      ...dayEvents.map(e => ({ ...e, type: 'event' as const })),
      ...dayTasks.map(t => ({ ...t, type: 'task' as const }))
    ]
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#131313]">
      {/* Header section wrapping both rows */}
      <div className="flex flex-col border-b border-white/[0.05] bg-[#131313] pr-[8px]">
        
        {/* Row 1: Days */}
        <div className="flex border-b border-white/[0.03]">
          <div className="w-16 border-r border-white/5 shrink-0 flex items-start px-2 py-2">
            <span className="text-[9px] text-stone-500 font-medium whitespace-nowrap">{timezoneOffset}</span>
          </div>
          <div className="flex-1 flex">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date())
              return (
                <div key={i} className="flex-1 py-1.5 flex items-center justify-center gap-[6px] border-r border-white/5 last:border-r-0">
                  <span className={cn(
                    "text-xs font-medium",
                    isToday ? "text-stone-300" : "text-stone-500"
                  )}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={cn(
                    "min-w-5 h-5 flex items-center justify-center text-xs font-bold rounded-sm px-1",
                    isToday ? "bg-[#ef4444] text-white" : "text-stone-500"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Row 2: All-day events */}
        <div className="flex min-h-[32px]">
          <div className="w-16 border-r border-white/5 shrink-0 flex items-center justify-center">
            <span className="text-[9px] text-stone-500 font-medium">All-day</span>
          </div>
          <div className="flex-1 flex">
            {weekDays.map((day, i) => {
              const allDayEvents = getAllDayItems(day)
              
              return (
                <div key={i} className="flex-1 border-r border-white/5 last:border-r-0 relative p-1 flex flex-col gap-1">
                  {allDayEvents.map(event => (
                    <div 
                      key={event.id}
                      className="flex-1 rounded-sm px-2 py-0.5 flex items-center min-h-[20px]"
                      style={{
                        backgroundColor: event.color ? `${event.color}40` : '#133c36', // Fallback to teal 20%
                        borderLeft: `3px solid ${event.color || '#2dd4bf'}`,
                      }}
                    >
                      <span 
                        className="text-[10px] font-bold leading-none truncate"
                        style={{ color: event.color || '#ccfbf1' }}
                      >
                        {event.title}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <TimeGrid>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, new Date())
          return (
            <div key={i} className="flex-1 relative border-r border-white/[0.03] last:border-r-0">
              
              {/* Grid content slots */}
              <div className="absolute inset-0 flex flex-col">
                {Array.from({ length: 24 }).map((_, hour) => {
                  const slotDate = new Date(day)
                  slotDate.setHours(hour, 0, 0, 0)
                  return (
                    <QuickCreateModal
                      key={hour}
                      defaultType="event"
                      defaultDate={slotDate}
                      trigger={
                        <button 
                          className="w-full hover:bg-white/[0.02] transition-colors cursor-pointer border-none outline-none"
                          style={{ height: `${HOUR_HEIGHT}px` }}
                        />
                      }
                    />
                  )
                })}
              </div>

              {/* Current time indicator - red line only in the active day's column */}
              {mounted && isToday && (
                <div 
                  className="absolute left-0 right-0 h-px bg-[#ef4444] z-40 pointer-events-none"
                  style={{ top: `${currentTimeTop}px` }}
                />
              )}

              {getGridItems(day).map((item) => {
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
                      "absolute left-1 right-1 rounded border p-1.5 overflow-hidden z-10 transition-all hover:z-20 cursor-pointer group/event",
                      item.type === 'event' 
                        ? "bg-[#1f1f1f] border-white/5 hover:bg-[#2a2a2a] shadow-sm" 
                        : "bg-blue-900/20 border-blue-500/20 hover:bg-blue-900/40"
                    )}
                    style={{ 
                      top: `${top}px`, 
                      height: `${height}px`,
                    }}
                  >
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-[3px] bg-opacity-70 group-hover/event:bg-opacity-100 transition-opacity"
                      style={{ 
                        backgroundColor: item.type === 'event' 
                          ? (item.color?.startsWith('bg-') ? undefined : item.color)
                          : '#3B82F6' 
                      }}
                    />
                    <div className="flex flex-col gap-0.5 h-full ml-1.5">
                      <div className="flex items-start gap-1">
                        {item.type === 'task' && <CheckSquare className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />}
                        <span className={cn(
                          "text-[10px] font-semibold leading-tight line-clamp-2 uppercase tracking-tighter",
                          item.type === 'event' ? "text-stone-300" : "text-blue-200"
                        )}>
                          {item.title}
                        </span>
                      </div>
                      {durationMinutes >= 45 && (
                        <span className="text-[9px] font-medium text-stone-500 uppercase">
                          {format(start, 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </TimeGrid>
    </div>
  )
}
