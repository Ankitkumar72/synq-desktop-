"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { AnimatePage } from "@/components/layout/animate-page"
import { cn } from "@/lib/utils"
import { useEventStore } from "@/shared"
import { useTaskStore } from "@/shared"
import { useHasMounted } from "@/hooks/use-has-mounted"
import {
  getMonthYearString,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  format,
  startOfMonth,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "@/lib/calendar-utils"
import { startOfWeek, eachDayOfInterval } from 'date-fns'
import { MonthView } from "@/components/calendar/month-view"
import { WeekView } from "@/components/calendar/week-view"
import { DayView } from "@/components/calendar/day-view"
import { YearView } from "@/components/calendar/year-view"
import { ItemDetail } from "@/components/calendar/item-detail"
import { Task, CalendarEvent } from "@/shared"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

export default function CalendarPage() {
  const params = useParams()
  const router = useRouter()
  
  const viewParam = ((params?.view as string) || 'month').toLowerCase()
  const validViews = ['month', 'week', 'day', 'overdue', 'schedule', 'tasks', 'events', 'year']
  const view = validViews.includes(viewParam) ? viewParam as any : 'month'

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(new Date())

  const [syncedCalendars, setSyncedCalendars] = useState<Record<string, boolean>>({
    google: true,
    microsoft: false,
  })
  const [isSyncedOpen, setIsSyncedOpen] = useState(true)

  const toggleSyncedCalendar = (id: string) => {
    setSyncedCalendars(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const events = useEventStore(s => s.events); const fetchEvents = useEventStore(s => s.fetchEvents)
  const tasks = useTaskStore(s => s.tasks); const fetchTasks = useTaskStore(s => s.fetchTasks)
  const hasMounted = useHasMounted()

  const [selectedItem, setSelectedItem] = useState<(Task & { type: 'task' }) | (CalendarEvent & { type: 'event' }) | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [itemToEdit, setItemToEdit] = useState<((Task & { type: 'task' }) | (CalendarEvent & { type: 'event' })) | null>(null)

  const handleItemClick = (item: (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' })) => {
    setSelectedItem(item)
    setIsDetailOpen(true)
  }

  const handleEdit = (item: (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' })) => {
    setIsDetailOpen(false)
    setItemToEdit(item)
    setIsEditModalOpen(true)
  }

  const setView = (newView: string) => {
    router.push(`/calendar/${newView.toLowerCase()}`)
  }

  useEffect(() => {
    if (events.length === 0) {
      fetchEvents()
    }
    if (tasks.length === 0) {
      fetchTasks()
    }
  }, [events.length, tasks.length, fetchEvents, fetchTasks])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return
      }

      // Don't trigger if modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'd':
          router.push('/calendar/day')
          break
        case 'w':
          router.push('/calendar/week')
          break
        case 'm':
          router.push('/calendar/month')
          break
        case 'y':
          router.push('/calendar/year')
          break
        case 's':
          router.push('/calendar/schedule')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  if (!hasMounted) return null

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1))
    else if (view === 'year') setCurrentDate(subMonths(currentDate, 12))
    else setCurrentDate(subDays(currentDate, 1))
  }

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
    else if (view === 'year') setCurrentDate(addMonths(currentDate, 12))
    else setCurrentDate(addDays(currentDate, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
    setMiniCalendarMonth(today)
  }

  const getHeaderTitle = () => {
    if (view === 'year') return format(currentDate, 'yyyy')
    return getMonthYearString(currentDate)
  }


  return (
    <AnimatePage className="h-full w-full">
      <div className="flex flex-1 h-full bg-transparent text-[#f2f2F2] overflow-hidden font-sans selection:bg-blue-500/30">
        <aside className="w-72 border-r border-white/5 flex flex-col pt-6 px-4 bg-white/[0.015] shrink-0 z-10">
          <div className="px-2 mb-8 flex justify-center">
            <QuickCreateModal
              defaultType="event"
              trigger={
                <Button
                  className="h-11 px-5 rounded-full bg-white text-black hover:bg-stone-200 transition-all flex items-center justify-center gap-2.5 group shadow-xl shadow-white/5 border border-white/10"
                >
                  <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                  <span className="text-[16px] font-bold tracking-tight">Create</span>
                </Button>
              }
            />
          </div>

          <div className="px-1 mb-6">
            <MiniCalendar
              viewDate={miniCalendarMonth}
              selectedDate={selectedDate}
              onViewDateChange={setMiniCalendarMonth}
              onSelectDate={(date) => {
                setSelectedDate(date)
                setCurrentDate(date)
                setMiniCalendarMonth(startOfMonth(date))
              }}
            />
          </div>



          <div className="px-2 mb-6">
            <div 
              className="flex items-center justify-between px-2 mb-3 group cursor-pointer" 
              onClick={() => setIsSyncedOpen(!isSyncedOpen)}
            >
              <span className="text-[14px] font-bold text-stone-300 group-hover:text-white transition-colors">
                My Calendars
              </span>
              <ChevronDown className={cn("w-4 h-4 text-stone-500 transition-transform duration-200", isSyncedOpen ? "" : "-rotate-90")} />
            </div>
            
            {isSyncedOpen && (
              <div className="space-y-0.5">
                <button
                  onClick={() => toggleSyncedCalendar('google')}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center border transition-all",
                    syncedCalendars.google 
                      ? "bg-blue-500 border-blue-500 text-white" 
                      : "border-stone-600 group-hover:border-stone-400 bg-transparent"
                  )}>
                    {syncedCalendars.google && <Check className="w-3 h-3" strokeWidth={3} />}
                  </div>
                  <span className="text-[15px] text-stone-400 group-hover:text-white transition-colors">Google Calendar</span>
                </button>
                <button
                  onClick={() => toggleSyncedCalendar('microsoft')}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center border transition-all",
                    syncedCalendars.microsoft 
                      ? "bg-blue-500 border-blue-500 text-white" 
                      : "border-stone-600 group-hover:border-stone-400 bg-transparent"
                  )}>
                    {syncedCalendars.microsoft && <Check className="w-3 h-3" strokeWidth={3} />}
                  </div>
                  <span className="text-[15px] text-stone-400 group-hover:text-white transition-colors">Microsoft Calendar</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-8 scrollbar-none pb-4">
            {/* Static Calendars section removed as requested */}
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-full bg-transparent relative min-h-0">
          <header className="h-16 border-b border-white/5 flex items-center px-10 justify-between bg-background/50 backdrop-blur-xl z-20 shrink-0 relative">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleToday}
                  className="h-9 px-6 rounded-xl font-bold text-[13px] tracking-wider bg-white/[0.03] border-white/5 hover:bg-white/[0.07] text-stone-400 hover:text-white transition-all shadow-none border"
                >
                  Today
                </Button>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 text-stone-300 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 text-stone-300 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                <h2 className="text-2xl font-display font-black tracking-tight text-white ml-3">
                  {getHeaderTitle()}
                </h2>
              </div>
            </div>

            {view === 'day' && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-[6px] cursor-pointer hover:bg-white/[0.03] px-3 py-1.5 rounded-xl transition-colors select-none">
                <span className="text-sm font-medium uppercase tracking-wider text-stone-400 leading-none mt-[2px]">
                  {format(currentDate, 'EEE')}
                </span>
                <span className={cn(
                  "min-w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full px-2",
                  isSameDay(currentDate, new Date()) ? "bg-white text-black shadow-md" : "text-stone-300"
                )}>
                  {format(currentDate, 'd')}
                </span>
              </div>
            )}

            <div className="flex items-center gap-6">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-white/5 rounded-lg transition-all outline-none group">
                      <span className="text-[15px] font-medium text-stone-400 group-hover:text-white transition-colors">
                        {view === 'overdue' ? 'Overdue' : view.charAt(0).toUpperCase() + view.slice(1)}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-stone-600 group-hover:text-stone-400 transition-colors" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" sideOffset={8} className="bg-[#121212] border-white/5 text-stone-400 min-w-[180px] rounded-xl overflow-hidden shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-200">
                  <DropdownMenuItem onClick={() => setView('day')} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-0.5 group">
                    <span className="text-[14px] font-medium tracking-tight">Day</span>
                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-stone-400">D</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('week')} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-0.5 group">
                    <span className="text-[14px] font-medium tracking-tight">Week</span>
                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-stone-400">W</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('month')} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-0.5 group">
                    <span className="text-[14px] font-medium tracking-tight">Month</span>
                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-stone-400">M</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('year')} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-0.5 group">
                    <span className="text-[14px] font-medium tracking-tight">Year</span>
                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-stone-400">Y</span>
                  </DropdownMenuItem>
                  
                  <div className="h-px bg-white/5 mx-2 my-2" />
                  
                  <DropdownMenuItem onClick={() => setView('schedule')} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-0.5 group">
                    <span className="text-[14px] font-medium tracking-tight">Schedule</span>
                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-stone-400">S</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {view === 'year' && (
              <YearView 
                currentDate={currentDate} 
                onSelectDate={(date) => {
                  setSelectedDate(date)
                  setCurrentDate(date)
                  setView('day')
                }} 
                onPrevYear={handlePrev}
                onNextYear={handleNext}
              />
            )}
            {view === 'month' && (
              <MonthView
                currentMonth={currentDate}
                events={events}
                tasks={tasks}
                onItemClick={handleItemClick}
                onSelectDate={(date) => {
                  setSelectedDate(date)
                  setCurrentDate(date)
                  setView('day')
                }}
              />
            )}
            {view === 'week' && (
              <WeekView 
                currentDate={currentDate} 
                events={events} 
                tasks={tasks} 
                onItemClick={handleItemClick}
                onSelectDate={(date) => {
                  setSelectedDate(date)
                  setCurrentDate(date)
                  setView('day')
                }}
              />
            )}
            {view === 'day' && <DayView currentDate={currentDate} events={events} tasks={tasks} onItemClick={handleItemClick} />}
            {view === 'schedule' && <ScheduleView />}
            {view === 'overdue' && <OverdueView />}
            {view === 'tasks' && <TasksView />}
            {view === 'events' && <EventsView />}
          </div>
        </main>
      </div>

      {selectedItem && (
        <ItemDetail 
          item={selectedItem} 
          open={isDetailOpen} 
          onOpenChange={setIsDetailOpen} 
          onEdit={handleEdit}
        />
      )}

      <QuickCreateModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        editItem={itemToEdit}
      />
    </AnimatePage>
  )
}

function MiniCalendar({
  viewDate,
  selectedDate,
  onSelectDate,
  onViewDateChange
}: {
  viewDate: Date,
  selectedDate: Date,
  onSelectDate: (date: Date) => void,
  onViewDateChange: (date: Date) => void
}) {
  const grid = useMemo(() => {
    const start = startOfMonth(viewDate)
    const gridStart = startOfWeek(start)
    return eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) }).slice(0, 42)
  }, [viewDate])

  const daysShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="p-2 select-none">
      <div className="flex items-center justify-between mb-5 px-1">
        <span className="text-[14px] font-bold text-stone-100 tracking-tight">
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-stone-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            onClick={() => onViewDateChange(subMonths(viewDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-stone-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            onClick={() => onViewDateChange(addMonths(viewDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {daysShort.map((day, i) => (
          <div key={i} className="text-[10px] font-semibold text-stone-600 text-center h-8 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {grid.map((date, i) => {
          const isSelected = isSameDay(date, selectedDate)
          const isCurrentMonth = isSameMonth(date, viewDate)
          const isToday = isSameDay(date, new Date())

          return (
            <div
              key={i}
              onClick={() => onSelectDate(date)}
              className={cn(
                "h-8 w-8 text-[12px] font-medium rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all mx-auto relative group",
                isSelected
                  ? "bg-white text-black shadow-xl scale-105"
                  : isToday
                    ? "text-blue-400 font-bold"
                    : isCurrentMonth
                      ? "text-stone-400 hover:text-white hover:bg-white/[0.03]"
                      : "text-stone-700 hover:text-stone-500"
              )}
            >
              <span>{format(date, 'd')}</span>
              {isToday && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 bg-blue-400 rounded-full" />
              )}
              {isSelected && (
                <div className="absolute -inset-[1px] rounded-xl border border-white/20 animate-pulse pointer-events-none" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScheduleView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-stone-500 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <h3 className="text-stone-300 font-bold mb-1">Upcoming Schedule</h3>
        <p className="text-sm">Your chronological agenda will appear here.</p>
      </div>
    </div>
  )
}

function OverdueView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-stone-500 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <h3 className="text-stone-300 font-bold mb-1 font-display">Overdue Items</h3>
        <p className="text-sm">Tasks past their deadline will be listed here.</p>
      </div>
    </div>
  )
}

function TasksView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-stone-500 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <h3 className="text-stone-300 font-bold mb-1 font-display">Task Board</h3>
        <p className="text-sm">Manage all your tasks in one unified view.</p>
      </div>
    </div>
  )
}

function EventsView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-stone-500 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <h3 className="text-stone-300 font-bold mb-1 font-display">Event List</h3>
        <p className="text-sm">Browse and manage your upcoming calendar events.</p>
      </div>
    </div>
  )
}
