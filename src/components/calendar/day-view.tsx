"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { 
  CheckSquare,
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
import { CurrentTimeLayer } from "./render/CurrentTimeLayer"
import { CalendarItem, ColumnRect } from "./types"

interface DayViewProps {
  currentDate: Date
  items: CalendarItem[]
  onItemClick: (item: CalendarItem) => void
  onItemTimeChange?: (id: string, type: 'task' | 'event', newStart: Date, newEnd: Date) => Promise<void>
}

export function DayView({ currentDate, items, onItemClick, onItemTimeChange }: DayViewProps) {
  const [containerHeight, setContainerHeight] = useState(1152)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wrapperRef.current) return
    const observer = new ResizeObserver(entries => {
      setContainerHeight(entries[0].contentRect.height)
    })
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  const HOUR_HEIGHT = Math.max(48, containerHeight / 24)
  const { layoutEngine, dragController } = useCalendarEngine({ hourHeight: HOUR_HEIGHT, columnWidth: 100 })
  const dragSession = useDragSession(dragController)
  const columnRef = useRef<HTMLDivElement | null>(null)

  const dayItems = useMemo(() => {
    return items.filter(item => isSameDay(new Date(item.start), currentDate) && !item.originalItem?.deleted_at)
  }, [currentDate, items])

  return (
    <div ref={wrapperRef} className="flex-1 flex flex-col overflow-hidden">
      <OverlayRenderer session={dragSession} />

      {/* Grid */}
      <TimeGrid hourHeight={HOUR_HEIGHT}>
        <div ref={columnRef} className="flex-1 relative bg-transparent">
          <CurrentTimeLayer currentDate={currentDate} hourHeight={HOUR_HEIGHT} />
          {/* Grid interactive slots */}
          <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col pointer-events-none">
            {Array.from({ length: 24 }).map((_, hour) => {
              const slotDate = new Date(currentDate)
              slotDate.setHours(hour, 0, 0, 0)
              return (
                <div key={hour} className="flex-1 flex flex-col">
                  <QuickCreateModal
                    defaultType="task"
                    defaultDate={slotDate}
                    trigger={
                      <button 
                        type="button"
                        className="w-full flex-1 h-full hover:bg-white/[0.02] transition-colors cursor-pointer pointer-events-auto border-none bg-transparent block p-0"
                      />
                    }
                  />
                </div>
              )
            })}
          </div>

          {layoutEngine.calculateDayRects(dayItems, 100, dragSession).map((rect) => {
            const item = dayItems.find(i => i.id === rect.eventId);
            if (!item) return null;
            
            const start = item.start;
            const end = item.end;
            const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000);

            const isDraggingThis = (dragSession.status === 'dragging' || dragSession.status === 'resizing') && dragSession.originalEvent?.id === item.id;

            return (
              <div 
                key={item.id}
                onPointerDown={(e) => {
                  const startX = e.clientX;
                  const startY = e.clientY;
                  let hasMoved = false;

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
                    if (Math.abs(moveEvt.clientX - startX) > 3 || Math.abs(moveEvt.clientY - startY) > 3) {
                      hasMoved = true;
                    }
                    dragController.updateDrag({ x: moveEvt.clientX, y: moveEvt.clientY }, cols, HOUR_HEIGHT)
                    
                    // Edge scrolling
                    const scrollContainer = document.querySelector('.time-grid-scroll') as HTMLDivElement
                    if (scrollContainer) {
                      const rect = scrollContainer.getBoundingClientRect()
                      const SCROLL_THRESHOLD = 60
                      const MAX_SCROLL_SPEED = 15
                      
                      if (moveEvt.clientY < rect.top + SCROLL_THRESHOLD) {
                        const speed = MAX_SCROLL_SPEED * (1 - (moveEvt.clientY - rect.top) / SCROLL_THRESHOLD)
                        scrollContainer.scrollBy(0, -speed)
                      } else if (moveEvt.clientY > rect.bottom - SCROLL_THRESHOLD) {
                        const speed = MAX_SCROLL_SPEED * (1 - (rect.bottom - moveEvt.clientY) / SCROLL_THRESHOLD)
                        scrollContainer.scrollBy(0, speed)
                      }
                    }
                  }
                  const upHandler = async () => {
                    const committed = dragController.commitDrag()
                    window.removeEventListener('pointermove', moveHandler)
                    window.removeEventListener('pointerup', upHandler)
                    
                    if (hasMoved && committed && onItemTimeChange) {
                      if (committed.start.getTime() !== item.start.getTime() || committed.end.getTime() !== item.end.getTime()) {
                        await onItemTimeChange(committed.id, committed.type as 'task' | 'event', committed.start, committed.end)
                      }
                    } else if (!hasMoved) {
                      onItemClick(item);
                    }
                  }
                  
                  window.addEventListener('pointermove', moveHandler)
                  window.addEventListener('pointerup', upHandler)
                }}
                className={cn(
                  "absolute rounded-md p-2 overflow-hidden z-10 transition-all hover:z-20 cursor-pointer group/event border",
                  item.type === 'event' 
                    ? "bg-[#4285F4]/20 border-[#4285F4]/30 hover:bg-[#4285F4]/30 text-[#4285F4]" 
                    : "bg-[#039BE5]/20 border-[#039BE5]/30 hover:bg-[#039BE5]/30 text-[#039BE5]",
                  isDraggingThis && "opacity-50 pointer-events-none"
                )}
                style={{ 
                  top: `${rect.y}px`, 
                  height: `${rect.height}px`,
                  left: `${rect.x}%`,
                  width: `calc(${rect.width}% - 2px)`,
                }}
              >
                {/* Top Resize Handle */}
                <div 
                  className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-30 hover:bg-white/10 transition-colors"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    let hasMoved = false;
                    
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
                      if (Math.abs(moveEvt.clientX - startX) > 3 || Math.abs(moveEvt.clientY - startY) > 3) {
                        hasMoved = true;
                      }
                      dragController.updateResize({ x: moveEvt.clientX, y: moveEvt.clientY }, cols, HOUR_HEIGHT)
                      
                      const scrollContainer = document.querySelector('.time-grid-scroll') as HTMLDivElement
                      if (scrollContainer) {
                        const rect = scrollContainer.getBoundingClientRect()
                        if (moveEvt.clientY < rect.top + 60) {
                          scrollContainer.scrollBy(0, -10)
                        } else if (moveEvt.clientY > rect.bottom - 60) {
                          scrollContainer.scrollBy(0, 10)
                        }
                      }
                    }
                    const upHandler = async () => {
                      const committed = dragController.commitDrag()
                      window.removeEventListener('pointermove', moveHandler)
                      window.removeEventListener('pointerup', upHandler)
                      if (hasMoved && committed && onItemTimeChange) {
                        if (committed.start.getTime() !== item.start.getTime() || committed.end.getTime() !== item.end.getTime()) {
                          await onItemTimeChange(committed.id, committed.type as 'task' | 'event', committed.start, committed.end)
                        }
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
                    const startX = e.clientX;
                    const startY = e.clientY;
                    let hasMoved = false;

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
                      if (Math.abs(moveEvt.clientX - startX) > 3 || Math.abs(moveEvt.clientY - startY) > 3) {
                        hasMoved = true;
                      }
                      dragController.updateResize({ x: moveEvt.clientX, y: moveEvt.clientY }, cols, HOUR_HEIGHT)
                      
                      const scrollContainer = document.querySelector('.time-grid-scroll') as HTMLDivElement
                      if (scrollContainer) {
                        const rect = scrollContainer.getBoundingClientRect()
                        if (moveEvt.clientY < rect.top + 60) {
                          scrollContainer.scrollBy(0, -10)
                        } else if (moveEvt.clientY > rect.bottom - 60) {
                          scrollContainer.scrollBy(0, 10)
                        }
                      }
                    }
                    const upHandler = async () => {
                      const committed = dragController.commitDrag()
                      window.removeEventListener('pointermove', moveHandler)
                      window.removeEventListener('pointerup', upHandler)
                      if (hasMoved && committed && onItemTimeChange) {
                        if (committed.start.getTime() !== item.start.getTime() || committed.end.getTime() !== item.end.getTime()) {
                          await onItemTimeChange(committed.id, committed.type as 'task' | 'event', committed.start, committed.end)
                        }
                      }
                    }

                    window.addEventListener('pointermove', moveHandler)
                    window.addEventListener('pointerup', upHandler)
                  }}
                />

                <div className="flex flex-col gap-1 h-full overflow-hidden">
                  <div className="flex items-start gap-1.5">
                    {item.type === 'task' && <CheckSquare className="w-3.5 h-3.5 mt-[1px] shrink-0 opacity-80" />}
                    <span className="text-xs font-semibold leading-tight truncate">
                      {item.title}
                    </span>
                  </div>
                  {durationMinutes >= 40 && (
                    <div className="flex items-center gap-1 opacity-60 font-medium text-[10px] uppercase tracking-wider">
                      <span>{format(start, 'h:mm a')}</span>
                    </div>
                  )}

                  {durationMinutes >= 60 && item.description && (
                    <div className="flex items-start gap-2 pt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <AlignLeft className="w-3 h-3 shrink-0 mt-[1px]" />
                      <p className="text-[11px] line-clamp-2 leading-snug font-medium">
                        {item.description}
                      </p>
                    </div>
                  )}

                  {durationMinutes >= 90 && item.type === 'event' && item.originalItem?.location && (
                    <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="text-[11px] truncate font-medium">
                        {item.originalItem.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Render drag preview ghost */}
          {(dragSession.status === 'dragging' || dragSession.status === 'resizing') && 
           dragSession.previewEvent && 
           isSameDay(new Date(dragSession.previewEvent.start), currentDate) && (
             <div
                className={cn(
                  "absolute rounded-md p-2 overflow-hidden z-30 pointer-events-none border opacity-70 shadow-2xl scale-[1.02] backdrop-blur-sm",
                  dragSession.previewEvent.type === 'event' 
                    ? "bg-[#4285F4]/30 border-[#4285F4]/50 text-[#4285F4]" 
                    : "bg-[#039BE5]/30 border-[#039BE5]/50 text-[#039BE5]"
                )}
                style={{
                  top: `${((dragSession.previewEvent.start.getHours() * 60 + dragSession.previewEvent.start.getMinutes()) / 60) * HOUR_HEIGHT}px`,
                  height: `${(Math.max(30, (dragSession.previewEvent.end.getTime() - dragSession.previewEvent.start.getTime()) / 60000) / 60) * HOUR_HEIGHT}px`,
                  left: '2px',
                  width: 'calc(100% - 4px)',
                }}
              >
                <div className="flex flex-col gap-1 h-full overflow-hidden">
                  <div className="flex items-start gap-1.5">
                    {dragSession.previewEvent.type === 'task' && <CheckSquare className="w-3.5 h-3.5 mt-[1px] shrink-0 opacity-80" />}
                    <span className="text-xs font-semibold leading-tight truncate">
                      {dragSession.previewEvent.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-80 font-medium text-[10px] uppercase tracking-wider">
                    <span>{format(dragSession.previewEvent.start, 'h:mm a')}</span>
                  </div>
                </div>
              </div>
          )}
        </div>
      </TimeGrid>
    </div>
  )
}


