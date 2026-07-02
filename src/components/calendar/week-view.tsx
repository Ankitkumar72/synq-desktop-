"use client"

import { useMemo, useState, useEffect } from "react"
import { 
  CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Task, CalendarEvent } from "@/shared"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { 
  startOfWeek, 
  addDays, 
  eachDayOfInterval, 
  format,
  isSameDay,
} from "date-fns"
import { TimeGrid } from "./time-grid"
import { useCalendarEngine, useDragSession } from "./hooks/useCalendarEngine"
import { OverlayRenderer } from "./render/OverlayRenderer"
import { CalendarItem } from "./types"

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
  onItemClick: (item: (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' })) => void
  onSelectDate?: (date: Date) => void
}

const isAllDayEvent = (event: CalendarEvent) => {
  const start = new Date(event.start_date)
  const end = new Date(event.end_date)
  return (end.getTime() - start.getTime()) >= 24 * 60 * 60 * 1000
}

const getTaskStart = (task: Task) => task.start_at || task.due_date

export function WeekView({ currentDate, events, tasks, onItemClick, onSelectDate }: WeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate)
    return eachDayOfInterval({ start, end: addDays(start, 6) })
  }, [currentDate])

  const HOUR_HEIGHT = 48
  const { layoutEngine, dragController } = useCalendarEngine({ hourHeight: HOUR_HEIGHT, columnWidth: 100 })
  const dragSession = useDragSession(dragController)
  
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
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date())
      const tzPart = parts.find(part => part.type === 'timeZoneName')
      if (tzPart && tzPart.value) {
        // Some browsers might return things like "GMT+5:30" instead of "IST" for some locales, 
        // but this is the standard way to get the abbreviation.
        return tzPart.value
      }
    } catch (e) {
      console.warn("Failed to get timezone abbreviation", e)
    }

    // Fallback if abbreviation isn't found
    const offset = new Date().getTimezoneOffset()
    const sign = offset > 0 ? '-' : '+'
    const absOffset = Math.abs(offset)
    const hours = Math.floor(absOffset / 60)
    const minutes = absOffset % 60
    return `GMT${sign}${hours}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''}`
  }, [])


  const getGridItems = (date: Date) => {
    // Regular time-bound events that start on this specific day
    const dayEvents = events.filter(event => 
      isSameDay(new Date(event.start_date), date) && !event.deleted_at && !isAllDayEvent(event)
    )
    const dayTasks = tasks.filter(task => 
      getTaskStart(task) && isSameDay(new Date(getTaskStart(task)!), date) && !task.deleted_at
    )
    
    const items = [
      ...dayEvents.map(e => ({ ...e, type: 'event' as const })),
      ...dayTasks.map(t => ({ ...t, type: 'task' as const }))
    ]

    if (items.length > 0) {
      console.log(`[WeekView] Items for ${date.toISOString()}:`, items)
    }

    return items
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A]">
      <OverlayRenderer session={dragSession} />
      {/* Header section wrapping both rows */}
      <div className="flex flex-col border-b border-white/10 bg-[#0A0A0A] pr-[8px]">
        
        {/* Row 1: Days */}
        <div className="flex border-b border-white/10">
          <div className="w-16 border-r border-white/10 shrink-0 flex items-start px-2 py-2">
            <span className="text-[10px] text-stone-400 font-medium whitespace-nowrap">{timezoneOffset}</span>
          </div>
          <div className="flex-1 flex">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date())
              return (
                <div 
                  key={i} 
                  onClick={() => onSelectDate?.(day)}
                  className="flex-1 py-1.5 flex items-center justify-center gap-[6px] border-r border-white/10 last:border-r-0 cursor-pointer hover:bg-white/[0.03] transition-colors group"
                >
                  <span className={cn(
                    "text-xs font-medium uppercase tracking-wider transition-colors",
                    isToday ? "text-white" : "text-stone-400 group-hover:text-stone-200"
                  )}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={cn(
                    "min-w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full px-1.5 transition-colors",
                    isToday ? "bg-white text-black shadow-md" : "text-stone-400 group-hover:text-stone-200"
                  )}>
                    {format(day, 'd')}
                  </span>
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
            <div key={i} className="flex-1 relative border-r border-white/[0.08] last:border-r-0">
              
              {/* Grid content slots */}
              <div className="absolute inset-0 flex flex-col">
                {Array.from({ length: 24 }).map((_, hour) => {
                  const slotDate = new Date(day)
                  slotDate.setHours(hour, 0, 0, 0)
                  return (
                    <QuickCreateModal
                      key={hour}
                      defaultType="task"
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
                  className="absolute left-0 right-0 h-px bg-[#ef4444] z-40 pointer-events-none flex items-center"
                  style={{ top: `${currentTimeTop}px` }}
                >
                  <div className="w-2 h-2 rounded-full bg-[#ef4444] -ml-1" />
                </div>
              )}

              {layoutEngine.calculateDayRects(getGridItems(day) as CalendarItem[], 100, dragSession).map((rect) => {
                const item = getGridItems(day).find(i => i.id === rect.eventId) as CalendarItem;
                if (!item) return null;
                
                const start = item.type === 'event'
                  ? new Date(item.start_date)
                  : new Date(item.start_at || item.due_date!)
                
                // Hide if it's the currently dragged original event
                if (dragSession.status === 'dragging' && dragSession.originalEvent?.id === item.id) {
                  return null; // The OverlayRenderer renders the drag preview
                }

                return (
                  <div 
                    key={item.id}
                    onClick={() => onItemClick(item as any)}
                    onPointerDown={(e) => {
                      dragController.beginDrag(item, { x: e.clientX, y: e.clientY })
                      
                      const moveHandler = (moveEvt: PointerEvent) => {
                        dragController.updateDrag({ x: moveEvt.clientX, y: moveEvt.clientY })
                      }
                      const upHandler = () => {
                        dragController.commitDrag()
                        window.removeEventListener('pointermove', moveHandler)
                        window.removeEventListener('pointerup', upHandler)
                      }
                      
                      window.addEventListener('pointermove', moveHandler)
                      window.addEventListener('pointerup', upHandler)
                    }}
                    className={cn(
                      "absolute rounded-lg border-l-[3px] p-2.5 overflow-hidden z-10 transition-all hover:z-20 cursor-pointer group/event shadow-lg",
                      item.type === 'event' 
                        ? "bg-[#4285F4]/10 border-[#4285F4] hover:bg-[#4285F4]/20" 
                        : "bg-[#039BE5]/10 border-[#039BE5] hover:bg-[#039BE5]/20"
                    )}
                    style={{ 
                      top: `${rect.y}px`, 
                      height: `${rect.height}px`,
                      left: `${rect.x}%`,
                      width: `calc(${rect.width}% - 4px)`, // Leave a little gap
                    }}
                  >
                    <div className="flex flex-col gap-1.5 h-full">
                      <div className="flex items-start gap-2">
                        {item.type === 'task' && <CheckSquare className="w-3.5 h-3.5 text-[#039BE5] mt-0.5 shrink-0" />}
                        <span className={cn(
                          "text-[11px] font-bold leading-tight line-clamp-2 uppercase tracking-tight",
                          item.type === 'event' ? "text-[#4285F4]" : "text-[#039BE5]"
                        )}>
                          {item.title}
                        </span>
                      </div>
                      {rect.height >= 40 && (
                        <div className="flex items-center gap-1 opacity-60">
                          <span className="text-[9px] font-bold uppercase">
                            {format(start, 'h:mm a')}
                          </span>
                        </div>
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
