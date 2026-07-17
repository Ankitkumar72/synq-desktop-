"use client"

import { useMemo, useState } from "react"
import { CheckSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Task, CalendarEvent } from "@/shared"
import {
  generateCalendarGrid,
  getDayString,
  isSameMonth,
  isSameDay,
} from "@/lib/calendar-utils"
import { CalendarItem } from "./types"
import { format } from "date-fns"

interface MonthViewProps {
  currentMonth: Date
  items: CalendarItem[]
  onSelectDate: (date: Date) => void
  onItemClick: (item: CalendarItem) => void
  onItemTimeChange?: (id: string, type: 'task' | 'event', newStart: Date, newEnd: Date) => Promise<void>
}

export function MonthView({
  currentMonth,
  items,
  onSelectDate,
  onItemClick,
  onItemTimeChange,
}: MonthViewProps) {
  const grid = useMemo(() => generateCalendarGrid(currentMonth), [currentMonth])
  const [activeDay, setActiveDay] = useState<Date | null>(null)
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number; width: number } | null>(null)

  const getTaskStart = (task: Task) => task.start_at || task.due_date

  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

  const getItemsForDay = (date: Date) => {
    const dayItems = items.filter(
      (item) => isSameDay(new Date(item.start), date) && !item.originalItem?.deleted_at
    )

    if (dayItems.length > 0) {
      console.log(`[MonthView] Items for ${date.toDateString()}:`, dayItems)
    }

    return dayItems
  }

  const handleShowMore = (e: React.MouseEvent, date: Date) => {
    e.stopPropagation()
    const cellEl = (e.currentTarget as HTMLElement).closest('.day-cell')
    if (cellEl) {
      const rect = cellEl.getBoundingClientRect()
      setPopoverRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      })
      setActiveDay(date)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0B0C] text-white overflow-hidden relative">
      {/* Days Row */}
      <div className="grid grid-cols-7 border-b border-white/5 bg-[#0B0B0C]">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-[10px] font-bold text-stone-500 tracking-wider"
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
          const dayItems = getItemsForDay(date)
          const visibleItems = dayItems.length > 3 ? dayItems.slice(0, 2) : dayItems
          const hasMore = dayItems.length > 3
          const moreCount = dayItems.length - 2

          return (
            <div
              key={i}
              onClick={() => onSelectDate(date)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  const dataStr = e.dataTransfer.getData('application/json');
                  if (dataStr) {
                    const payload = JSON.parse(dataStr);
                    if (payload.id && payload.type) {
                      const targetDay = new Date(date);
                      let startHour = 12;
                      let startMinutes = 0;
                      let durationMs = 30 * 60 * 1000;

                      if (payload.startHour !== undefined) startHour = payload.startHour;
                      if (payload.startMinutes !== undefined) startMinutes = payload.startMinutes;
                      if (payload.durationMs !== undefined) durationMs = payload.durationMs;

                      const newStart = new Date(targetDay);
                      newStart.setHours(startHour, startMinutes, 0, 0);
                      const newEnd = new Date(newStart.getTime() + durationMs);

                      if (onItemTimeChange) {
                        await onItemTimeChange(payload.id, payload.type, newStart, newEnd);
                      }
                    }
                  }
                } catch (err) {
                  console.error("MonthView drop handler failed", err);
                }
              }}
              className={cn(
                "min-h-[120px] p-3 flex flex-col group cursor-pointer transition day-cell",
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
              <div className="space-y-1 overflow-y-auto scrollbar-none flex-1">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onItemClick(item)
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        id: item.id,
                        type: item.type,
                        title: item.title,
                        durationMs: item.end.getTime() - item.start.getTime(),
                        startHour: item.start.getHours(),
                        startMinutes: item.start.getMinutes()
                      }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all hover:brightness-110 cursor-grab active:cursor-grabbing",
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

                {hasMore && (
                  <button
                    onClick={(e) => handleShowMore(e, date)}
                    className="w-full text-left px-2 py-1 text-[9px] font-bold text-stone-400 hover:text-white hover:bg-white/5 rounded-md transition"
                  >
                    + {moreCount} MORE
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Floating Popover Portal Overlay */}
      {activeDay && popoverRect && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs" 
            onClick={() => { setActiveDay(null); setPopoverRect(null); }}
          />
          <div 
            className="fixed z-50 bg-[#151518] border border-white/10 rounded-xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: `${Math.min(popoverRect.top - 10, window.innerHeight - 320)}px`,
              left: `${popoverRect.left - 10}px`,
              width: `${popoverRect.width + 20}px`,
              minHeight: '150px',
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                {format(activeDay, 'EEEE, MMM d')}
              </span>
              <button 
                onClick={() => { setActiveDay(null); setPopoverRect(null); }}
                className="text-stone-500 hover:text-white text-[10px] font-bold px-2 py-0.5 rounded-md hover:bg-white/5 transition"
              >
                CLOSE
              </button>
            </div>
            
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {getItemsForDay(activeDay).map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onItemClick(item)
                    setActiveDay(null)
                    setPopoverRect(null)
                  }}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      id: item.id,
                      type: item.type,
                      title: item.title,
                      durationMs: item.end.getTime() - item.start.getTime(),
                      startHour: item.start.getHours(),
                      startMinutes: item.start.getMinutes()
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:brightness-110 cursor-grab active:cursor-grabbing",
                    item.type === "event"
                      ? "bg-[#4285F4] text-white shadow-sm shadow-[#4285F4]/20"
                      : "bg-[#039BE5]/20 text-[#039BE5] border border-[#039BE5]/30"
                  )}
                >
                  {item.type === "task" && (
                    <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                  )}

                  <span className="truncate tracking-tight leading-tight uppercase">
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
