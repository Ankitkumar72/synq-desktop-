"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { 
  CheckSquare,
  Clock,
  MapPin,
  AlignLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { 
  isSameDay,
  format,
} from "date-fns"
import { TimeGrid } from "./time-grid"
import { useCalendarEngine, useDragSession } from "./hooks/useCalendarEngine"
import { OverlayRenderer } from "./render/OverlayRenderer"
import { CalendarItem, ColumnRect } from "./types"

interface DayViewProps {
  currentDate: Date
  items: CalendarItem[]
  onItemClick: (item: CalendarItem) => void
  onItemTimeChange?: (id: string, type: 'task' | 'event', newStart: Date, newEnd: Date) => Promise<void>
}

export function DayView({ currentDate, items, onItemClick, onItemTimeChange }: DayViewProps) {
  const HOUR_HEIGHT = 48
  const { layoutEngine, dragController } = useCalendarEngine({ hourHeight: HOUR_HEIGHT, columnWidth: 100 })
  const dragSession = useDragSession(dragController)
  const columnRef = useRef<HTMLDivElement | null>(null)

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

  const dayItems = useMemo(() => {
    return items.filter(item => isSameDay(new Date(item.start), currentDate) && !item.originalItem?.deleted_at)
  }, [currentDate, items])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <OverlayRenderer session={dragSession} />

      {/* Grid */}
      <TimeGrid hourHeight={HOUR_HEIGHT}>
        <div ref={columnRef} className="flex-1 relative bg-transparent">
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

          {layoutEngine.calculateDayRects(dayItems, 100, dragSession).map((rect) => {
            const item = dayItems.find(i => i.id === rect.eventId);
            if (!item) return null;
            
            const start = item.start;
            const end = item.end;
            const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000);

            // Hide if it's the currently dragged or resized original event
            if ((dragSession.status === 'dragging' || dragSession.status === 'resizing') && dragSession.originalEvent?.id === item.id) {
              return null;
            }

            return (
              <div 
                key={item.id}
                onClick={() => onItemClick(item)}
                onPointerDown={(e) => {
                  const getColumnRect = (): ColumnRect[] => {
                    if (!columnRef.current) return [];
                    const r = columnRef.current.getBoundingClientRect();
                    return [{
                      date: currentDate,
                      left: r.left,
                      right: r.right,
                      top: r.top,
                      bottom: r.bottom,
                    }];
                  };

                  const cols = getColumnRect();
                  dragController.beginDrag(item, { x: e.clientX, y: e.clientY })
                  
                  const moveHandler = (moveEvt: PointerEvent) => {
                    dragController.updateDrag({ x: moveEvt.clientX, y: moveEvt.clientY }, cols, HOUR_HEIGHT)
                  }
                  const upHandler = async () => {
                    const committed = dragController.commitDrag()
                    window.removeEventListener('pointermove', moveHandler)
                    window.removeEventListener('pointerup', upHandler)
                    if (committed && onItemTimeChange) {
                      await onItemTimeChange(committed.id, committed.type as 'task' | 'event', committed.start, committed.end)
                    }
                  }
                  
                  window.addEventListener('pointermove', moveHandler)
                  window.addEventListener('pointerup', upHandler)
                }}
                className={cn(
                  "absolute rounded-xl border-l-[4px] p-6 overflow-hidden z-10 transition-all hover:z-20 cursor-pointer group/event shadow-2xl",
                  item.type === 'event' 
                    ? "bg-[#4285F4]/5 border-[#4285F4] hover:bg-[#4285F4]/10" 
                    : "bg-[#039BE5]/5 border-[#039BE5] hover:bg-[#039BE5]/10"
                )}
                style={{ 
                  top: `${rect.y}px`, 
                  height: `${rect.height}px`,
                  left: `${rect.x}%`,
                  width: `calc(${rect.width}% - 12px)`,
                }}
              >
                {/* Top Resize Handle */}
                <div 
                  className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-30 hover:bg-white/10 transition-colors"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const getColumnRect = (): ColumnRect[] => {
                      if (!columnRef.current) return [];
                      const r = columnRef.current.getBoundingClientRect();
                      return [{
                        date: currentDate,
                        left: r.left,
                        right: r.right,
                        top: r.top,
                        bottom: r.bottom,
                      }];
                    };

                    const cols = getColumnRect();
                    dragController.beginResize(item, { x: e.clientX, y: e.clientY }, 'top')

                    const moveHandler = (moveEvt: PointerEvent) => {
                      dragController.updateResize({ x: moveEvt.clientX, y: moveEvt.clientY }, cols, HOUR_HEIGHT)
                    }
                    const upHandler = async () => {
                      const committed = dragController.commitDrag()
                      window.removeEventListener('pointermove', moveHandler)
                      window.removeEventListener('pointerup', upHandler)
                      if (committed && onItemTimeChange) {
                        await onItemTimeChange(committed.id, committed.type as 'task' | 'event', committed.start, committed.end)
                      }
                    }

                    window.addEventListener('pointermove', moveHandler)
                    window.addEventListener('pointerup', upHandler)
                  }}
                />

                {/* Bottom Resize Handle */}
                <div 
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-30 hover:bg-white/10 transition-colors"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const getColumnRect = (): ColumnRect[] => {
                      if (!columnRef.current) return [];
                      const r = columnRef.current.getBoundingClientRect();
                      return [{
                        date: currentDate,
                        left: r.left,
                        right: r.right,
                        top: r.top,
                        bottom: r.bottom,
                      }];
                    };

                    const cols = getColumnRect();
                    dragController.beginResize(item, { x: e.clientX, y: e.clientY }, 'bottom')

                    const moveHandler = (moveEvt: PointerEvent) => {
                      dragController.updateResize({ x: moveEvt.clientX, y: moveEvt.clientY }, cols, HOUR_HEIGHT)
                    }
                    const upHandler = async () => {
                      const committed = dragController.commitDrag()
                      window.removeEventListener('pointermove', moveHandler)
                      window.removeEventListener('pointerup', upHandler)
                      if (committed && onItemTimeChange) {
                        await onItemTimeChange(committed.id, committed.type as 'task' | 'event', committed.start, committed.end)
                      }
                    }

                    window.addEventListener('pointermove', moveHandler)
                    window.addEventListener('pointerup', upHandler)
                  }}
                />

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
                            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
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

                  {durationMinutes >= 90 && item.type === 'event' && item.originalItem?.location && (
                    <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                      <MapPin className="w-4 h-4 text-stone-600 shrink-0" />
                      <span className="text-[13px] text-stone-400 truncate font-medium">
                        {item.originalItem.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {/* Render drag preview ghost if dragging in DayView */}
          {(dragSession.status === 'dragging' || dragSession.status === 'resizing') && 
           dragSession.previewEvent && 
           isSameDay(new Date(dragSession.previewEvent.start), currentDate) && (
            <div
              className={cn(
                "absolute left-4 right-8 rounded-xl border-l-[4px] p-6 overflow-hidden z-20 pointer-events-none opacity-40 border-dashed border-2",
                dragSession.previewEvent.type === 'event' 
                  ? "bg-[#4285F4]/20 border-[#4285F4]" 
                  : "bg-[#039BE5]/20 border-[#039BE5]"
              )}
              style={{
                top: `${((dragSession.previewEvent.start.getHours() * 60 + dragSession.previewEvent.start.getMinutes()) / 60) * HOUR_HEIGHT}px`,
                height: `${(Math.max(30, (dragSession.previewEvent.end.getTime() - dragSession.previewEvent.start.getTime()) / 60000) / 60) * HOUR_HEIGHT}px`,
              }}
            >

              <div className="flex flex-col gap-4 h-full overflow-hidden justify-center">
                <span className="text-xl font-bold uppercase tracking-tight opacity-75 truncate">
                  {dragSession.previewEvent.title}
                </span>
              </div>
            </div>
          )}
        </div>
      </TimeGrid>
    </div>
  )
}


