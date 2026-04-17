"use client"

import { useMemo } from "react"
import { 
  CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Task, CalendarEvent } from "@/types"
import { 
  generateCalendarGrid, 
  getDayString, 
  isSameMonth, 
  isSameDay, 
} from "@/lib/calendar-utils"

interface MonthViewProps {
  currentMonth: Date
  events: CalendarEvent[]
  tasks: Task[]
  onSelectDate: (date: Date) => void
}

export function MonthView({ currentMonth, events, tasks, onSelectDate }: MonthViewProps) {
  const grid = useMemo(() => generateCalendarGrid(currentMonth), [currentMonth])
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const getItemsForDay = (date: Date) => {
    const dayEvents = events.filter(event => isSameDay(new Date(event.start_date), date) && !event.deleted_at)
    const dayTasks = tasks.filter(task => task.due_date && isSameDay(new Date(task.due_date), date) && !task.deleted_at)
    
    return [
      ...dayEvents.map(e => ({ ...e, type: 'event' as const })),
      ...dayTasks.map(t => ({ ...t, type: 'task' as const }))
    ]
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/5">
        {daysOfWeek.map((day) => (
          <div key={day} className="py-4 text-center text-[10px] font-black text-stone-600 tracking-[0.2em] border-r border-white/5 last:border-r-0 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6 divide-white/5 divide-x divide-y overflow-y-auto scrollbar-none border-b border-white/5">
        {grid.map((date, i) => {
          const isToday = isSameDay(date, new Date())
          const isCurrentMonth = isSameMonth(date, currentMonth)

          return (
            <div 
              key={i} 
              onClick={() => onSelectDate(date)}
              className={cn(
                "min-h-[140px] flex flex-col p-2 transition-all duration-300 group relative cursor-pointer",
                !isCurrentMonth && "bg-black/20 opacity-40",
                isCurrentMonth && "hover:bg-white/[0.01]"
              )}
            >
              <div className="flex justify-end mb-2">
                 <span className={cn(
                  "w-8 h-8 flex items-center justify-center text-[13px] font-bold rounded-xl transition-all",
                  isToday ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" : 
                  isCurrentMonth ? "text-stone-400 group-hover:text-white" : "text-stone-800"
                )}>
                  {getDayString(date)}
                </span>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto scrollbar-none px-1">
                {getItemsForDay(date).map((item) => (
                  <div 
                    key={item.id}
                    className={cn(
                      "group/event relative pl-2 py-1.5 rounded-lg border transition-all cursor-pointer overflow-hidden backdrop-blur-sm",
                      item.type === 'event' 
                        ? "bg-white/[0.03] border-white/5 hover:bg-white/10" 
                        : "bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10"
                    )}
                  >
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-full opacity-70 group-hover/event:opacity-100 transition-opacity"
                      style={{ 
                        backgroundColor: item.type === 'event' 
                          ? (item.color?.startsWith('bg-') ? undefined : item.color)
                          : '#3B82F6' 
                      }}
                    />
                    <div className="flex items-center gap-1.5">
                      {item.type === 'task' && <CheckSquare className="w-3 h-3 text-blue-400 shrink-0" />}
                      <div className={cn(
                        "text-[11px] font-bold truncate pr-1 leading-none uppercase tracking-tight",
                        item.type === 'event' ? "text-stone-200" : "text-blue-200",
                        item.type === 'task' && (item as unknown as Task).status === 'done' && "line-through opacity-50"
                      )}>
                        {item.title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
