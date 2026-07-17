"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { 
  CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { 
  startOfWeek, 
  addDays, 
  eachDayOfInterval, 
  format,
  isSameDay,
} from "date-fns"
import { TimeGrid } from "./time-grid"
import { useTaskStore } from "@/shared"
import { useCalendarEngine, useDragSession } from "./hooks/useCalendarEngine"
import { OverlayRenderer } from "./render/OverlayRenderer"
import { CurrentTimeLayer } from "./render/CurrentTimeLayer"
import { CalendarItem, ColumnRect } from "./types"

interface WeekViewProps {
  currentDate: Date
  items: CalendarItem[]
  onItemClick: (item: CalendarItem) => void
  onSelectDate?: (date: Date) => void
  onItemTimeChange?: (id: string, type: 'task' | 'event', newStart: Date, newEnd: Date) => Promise<void>
}

export function WeekView({ currentDate, items, onItemClick, onSelectDate, onItemTimeChange }: WeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate)
    return eachDayOfInterval({ start, end: addDays(start, 6) })
  }, [currentDate])

  const [containerHeight, setContainerHeight] = useState(1152)
  const [headerHeight, setHeaderHeight] = useState(38)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wrapperRef.current) return
    const observer = new ResizeObserver(entries => {
      setContainerHeight(entries[0].contentRect.height)
    })
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!headerRef.current) return
    const observer = new ResizeObserver(() => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.getBoundingClientRect().height)
      }
    })
    observer.observe(headerRef.current)
    return () => observer.disconnect()
  }, [])

  const HOUR_HEIGHT = Math.max(48, (containerHeight - headerHeight) / 24)
  const { layoutEngine, dragController } = useCalendarEngine({ hourHeight: HOUR_HEIGHT, columnWidth: 100 })
  const dragSession = useDragSession(dragController)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])
  const updateTask = useTaskStore(s => s.updateTask)
  
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
    const dayItems = items.filter(item => 
      isSameDay(new Date(item.start), date) && !item.originalItem?.deleted_at && !item.allDay
    )
    
    if (dayItems.length > 0) {
      console.log(`[WeekView] Items for ${date.toISOString()}:`, dayItems)
    }

    return dayItems
  }

  return (
    <div ref={wrapperRef} className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A]">
      <OverlayRenderer session={dragSession} />

      {/* Main Grid */}
      <TimeGrid
        header={
          <div ref={headerRef} className="flex flex-col bg-[#0A0A0A]/95 backdrop-blur-md">
            {/* Row 1: Days */}
            <div className="flex border-b border-white/10">
              <div className="w-14 border-r border-white/10 shrink-0 flex items-start px-2 py-2">
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
        }
      >
        <CurrentTimeLayer isWeekView hourHeight={HOUR_HEIGHT} currentDate={null} />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, new Date())
          return (
            <div 
              key={i} 
              ref={el => { columnRefs.current[i] = el }}
              className="flex-1 relative border-r border-white/[0.08] last:border-r-0"
            >
              
              {/* Grid content slots */}
              <div className="absolute inset-0 flex flex-col">
                {Array.from({ length: 24 }).map((_, hour) => {
                  const slotDate = new Date(day)
                  slotDate.setHours(hour, 0, 0, 0)
                  return (
                    <div
                      key={hour}
                      className="flex-1 flex flex-col"
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        try {
                          const data = e.dataTransfer.getData('application/json');
                          if (data) {
                            const item = JSON.parse(data);
                            if (item.type === 'task') {
                              const endAt = new Date(slotDate);
                              endAt.setMinutes(endAt.getMinutes() + 30);
                              await updateTask(item.id, { 
                                start_at: slotDate.toISOString(),
                                end_at: endAt.toISOString()
                              });
                            }
                          }
                        } catch (error) {
                          console.error('Failed to sync calendar:', error)
                        }
                      }}
                    >
                      <QuickCreateModal
                        defaultType="task"
                        defaultDate={slotDate}
                        trigger={
                          <button 
                            className="w-full flex-1 h-full hover:bg-white/[0.02] transition-colors cursor-pointer border-none outline-none"
                          />
                        }
                      />
                    </div>
                  )
                })}
              </div>

              {layoutEngine.calculateDayRects(getGridItems(day) as CalendarItem[], 100, dragSession).map((rect) => {
                const item = getGridItems(day).find(i => i.id === rect.eventId) as CalendarItem;
                if (!item) return null;
                
                const start = new Date(item.start)
                
                const isDraggingThis = (dragSession.status === 'dragging' || dragSession.status === 'resizing') && dragSession.originalEvent?.id === item.id;

                return (
                  <div 
                    key={item.id}
                onPointerDown={(e) => {
                  const startX = e.clientX;
                  const startY = e.clientY;
                  let hasMoved = false;

                  const getColumns = () => {
                    return columnRefs.current.map((el, idx) => {
                      if (!el) return null;
                      const r = el.getBoundingClientRect();
                      return {
                        date: weekDays[idx],
                        left: r.left,
                        right: r.right,
                        top: r.top,
                        bottom: r.bottom,
                      };
                    }).filter(Boolean) as ColumnRect[];
                  };

                  const cols = getColumns();
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
                      onItemClick(item as any);
                    }
                  }
                  
                  window.addEventListener('pointermove', moveHandler)
                  window.addEventListener('pointerup', upHandler)
                }}
                    className={cn(
                      "absolute rounded-md p-1.5 overflow-hidden z-10 transition-all hover:z-20 cursor-pointer group/event border",
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
                      className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-30 hover:bg-white/10 transition-colors"
                      onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      let hasMoved = false;
                      
                      const getColumns = () => {
                        return columnRefs.current.map((el, idx) => {
                          if (!el) return null;
                          const r = el.getBoundingClientRect();
                          return {
                            date: weekDays[idx],
                            left: r.left,
                            right: r.right,
                            top: r.top,
                            bottom: r.bottom,
                          };
                        }).filter(Boolean) as ColumnRect[];
                      };

                      const cols = getColumns();
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
                      className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize z-30 hover:bg-white/10 transition-colors"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();

                        const getColumns = () => {
                          return columnRefs.current.map((el, idx) => {
                            if (!el) return null;
                            const r = el.getBoundingClientRect();
                            return {
                              date: weekDays[idx],
                              left: r.left,
                              right: r.right,
                              top: r.top,
                              bottom: r.bottom,
                            };
                          }).filter(Boolean) as ColumnRect[];
                        };

                        const cols = getColumns();
                        dragController.beginResize(item, { x: e.clientX, y: e.clientY }, 'bottom')

                        const moveHandler = (moveEvt: PointerEvent) => {
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
                          if (committed && onItemTimeChange) {
                            await onItemTimeChange(committed.id, committed.type as 'task' | 'event', committed.start, committed.end)
                          }
                        }

                        window.addEventListener('pointermove', moveHandler)
                        window.addEventListener('pointerup', upHandler)
                      }}
                    />

                    <div className="flex flex-col gap-1 h-full overflow-hidden">
                      <div className="flex items-start gap-1.5">
                        {item.type === 'task' && <CheckSquare className="w-3.5 h-3.5 text-[#039BE5] mt-0.5 shrink-0" />}
                        <span className={cn(
                          "text-[10px] font-bold leading-snug line-clamp-2 uppercase tracking-tight",
                          item.type === 'event' ? "text-[#4285F4]" : "text-[#039BE5]"
                        )}>
                          {item.title}
                        </span>
                      </div>
                      {rect.height >= 40 && (
                        <div className="flex items-center gap-1 opacity-60 text-stone-500 font-bold text-[9px] uppercase tracking-wider mt-0.5">
                          <span>
                            {format(start, 'h:mm a')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                )
              })}

              {/* Render drag preview ghost for this column */}
              {(dragSession.status === 'dragging' || dragSession.status === 'resizing') && 
               dragSession.previewEvent && 
               isSameDay(new Date(dragSession.previewEvent.start), day) && (
                 <div
                    className={cn(
                      "absolute rounded-md p-1.5 overflow-hidden z-30 pointer-events-none border opacity-70 shadow-2xl scale-[1.02] backdrop-blur-sm",
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
                        {dragSession.previewEvent.type === 'task' && <CheckSquare className="w-3.5 h-3.5 text-[#039BE5] mt-0.5 shrink-0 opacity-80" />}
                        <span className={cn(
                          "text-[10px] font-bold leading-snug line-clamp-2 uppercase tracking-tight",
                          dragSession.previewEvent.type === 'event' ? "text-[#4285F4]" : "text-[#039BE5]"
                        )}>
                          {dragSession.previewEvent.title}
                        </span>
                      </div>
                    </div>
                  </div>
              )}
            </div>
          )
        })}
      </TimeGrid>
    </div>
  )
}
