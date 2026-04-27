"use client"

import { useMemo } from "react"
import { CheckSquare } from "lucide-react"
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
  onItemClick: (item: (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' })) => void
}

export function MonthView({
  currentMonth,
  events,
  tasks,
  onSelectDate,
  onItemClick,
}: MonthViewProps) {
  const grid = useMemo(() => generateCalendarGrid(currentMonth), [currentMonth])

  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]


  const getItemsForDay = (date: Date) => {
    const dayEvents = events.filter(
      (event) =>
        isSameDay(new Date(event.start_date), date) && !event.deleted_at
    )
    const dayTasks = tasks.filter(
      (task) =>
        task.due_date &&
        isSameDay(new Date(task.due_date), date) &&
        !task.deleted_at
    )

    return [
      ...dayEvents.map((e) => ({ ...e, type: "event" as const })),
      ...dayTasks.map((t) => ({ ...t, type: "task" as const })),
    ]
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0B0C] text-white overflow-hidden">
      {/* Days Row */}
      <div className="grid grid-cols-7 border-b border-white/5">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-[11px] text-stone-500 tracking-wide"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-[repeat(6,1fr)] divide-x divide-y divide-white/5 overflow-hidden">
        {grid.map((date, i) => {
          const isToday = isSameDay(date, new Date())
          const isCurrentMonth = isSameMonth(date, currentMonth)

          return (
            <div
              key={i}
              onClick={() => onSelectDate(date)}
              className={cn(
                "min-h-[120px] p-3 flex flex-col group cursor-pointer transition",
                !isCurrentMonth && "opacity-30",
                isCurrentMonth && "hover:bg-white/[0.02]"
              )}
            >
              {/* Date */}
              <div className="flex justify-end mb-2">
                <span
                  className={cn(
                    "text-[12px] w-6 h-6 flex items-center justify-center rounded-md font-bold",
                    isToday
                      ? "bg-white text-black"
                      : "text-stone-400 group-hover:text-white"
                  )}
                >
                  {getDayString(date)}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-1 overflow-y-auto scrollbar-none max-h-[calc(100%-32px)]">
                {getItemsForDay(date).map((item) => (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onItemClick(item)
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all hover:brightness-110",
                      item.type === "event"
                        ? "bg-[#4285F4] text-white shadow-sm shadow-[#4285F4]/20"
                        : "bg-[#039BE5]/20 text-[#039BE5] border border-[#039BE5]/30"
                    )}
                  >
                    {item.type === "task" && (
                      <CheckSquare className="w-3 h-3 shrink-0" />
                    )}

                    <span className="truncate tracking-tight leading-tight uppercase">
                      {item.title}
                    </span>
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