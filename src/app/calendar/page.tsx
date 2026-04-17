"use client"

import { useState, useMemo } from "react"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Settings,
  HelpCircle,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuickCreateModal } from "@/components/layout/quick-create"
import { AnimatePage } from "@/components/layout/animate-page"
import { cn } from "@/lib/utils"
import { useEventStore } from "@/lib/store/use-event-store"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { useEffect } from "react"
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
  getWeekRangeString,
  getDayFullString,
} from "@/lib/calendar-utils"
import { startOfWeek, eachDayOfInterval } from 'date-fns'
import { MonthView } from "@/components/calendar/month-view"
import { WeekView } from "@/components/calendar/week-view"
import { DayView } from "@/components/calendar/day-view"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'week' | 'day' | 'overdue' | 'schedule'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(new Date())

  const { events, fetchEvents } = useEventStore()
  const { tasks, fetchTasks } = useTaskStore()
  const hasMounted = useHasMounted()

  useEffect(() => {
    fetchEvents()
    fetchTasks()
  }, [fetchEvents, fetchTasks])

  if (!hasMounted) return null

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1))
    else setCurrentDate(subDays(currentDate, 1))
  }

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
    else setCurrentDate(addDays(currentDate, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
    setMiniCalendarMonth(today)
  }

  const getHeaderTitle = () => {
    if (view === 'month') return getMonthYearString(currentDate)
    if (view === 'week') return getWeekRangeString(currentDate)
    if (view === 'day') return getDayFullString(currentDate)
    if (view === 'overdue') return "Overdue Tasks"
    if (view === 'schedule') return "Upcoming Schedule"
    return ""
  }


  return (
    <AnimatePage className="h-full w-full">
      <div className="flex flex-1 h-full bg-[#0A0A0A] text-[#f2f2F2] overflow-hidden font-sans selection:bg-blue-500/30">
        <aside className="w-72 border-r border-white/5 flex flex-col pt-6 px-4 bg-[#0e0e0e] shrink-0 z-10">
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
                setCurrentDate(startOfMonth(date))
                setMiniCalendarMonth(startOfMonth(date))
              }}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-8 scrollbar-none pb-4">
            {/* Static Calendars section removed as requested */}
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-full bg-[#0A0A0A] relative">
          <header className="h-16 border-b border-white/5 flex items-center px-10 justify-between bg-background/50 backdrop-blur-xl z-20 shrink-0">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleToday}
                  className="h-9 px-6 rounded-xl font-bold text-[13px] tracking-wider bg-white/[0.03] border-white/5 hover:bg-white/[0.07] text-stone-400 hover:text-white transition-all shadow-none border"
                >
                  Today
                </Button>
                <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-xl p-1 border border-white/5">
                  <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 text-stone-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 text-stone-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                <h2 className="text-2xl font-display font-black tracking-tight text-white ml-3">
                  {getHeaderTitle()}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-5 py-2 cursor-pointer hover:bg-white/5 transition-all outline-none group">
                      <span className="text-[17px] font-medium text-stone-400 tracking-tight group-hover:text-white transition-colors">
                        {view === 'overdue' ? 'Overdue Tasks' : view.charAt(0).toUpperCase() + view.slice(1)}
                      </span>
                      <ChevronDown className="w-4 h-4 text-stone-600 group-hover:text-stone-400" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" sideOffset={8} className="bg-[#0e0e0e] border-white/5 text-stone-400 min-w-[160px] rounded-xl overflow-hidden shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-200">
                  <DropdownMenuItem onClick={() => setView('month')} className="px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-0.5 group">
                    <span className="text-[15px] font-medium tracking-tight">Month</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('week')} className="px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-0.5 group">
                    <span className="text-[15px] font-medium tracking-tight">Week</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('day')} className="px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-2 group">
                    <span className="text-[15px] font-medium tracking-tight">Day</span>
                  </DropdownMenuItem>

                  <div className="h-px bg-white/5 mx-2 my-1" />
                  <div className="px-4 py-2 mb-0.5">
                    <span className="text-[13px] font-black text-stone-600 tracking-[0.2em]">Insights</span>
                  </div>

                  <DropdownMenuItem onClick={() => setView('schedule')} className="px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg mb-0.5 group">
                    <span className="text-[15px] font-medium tracking-tight">Schedule</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('overdue')} className="px-4 py-2 hover:bg-white/5 hover:text-white cursor-pointer transition-all rounded-lg group">
                    <span className="text-[15px] font-medium tracking-tight">Overdue Tasks</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="h-6 w-px bg-white/10 mx-2" />
              <div className="flex items-center gap-2">
                {[Search, Settings, HelpCircle].map((Icon, idx) => (
                  <Button key={idx} variant="ghost" size="icon" className="h-10 w-10 text-stone-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                    <Icon className="w-5 h-5" />
                  </Button>
                ))}
              </div>
            </div>
          </header>

          <div className="flex-1 flex flex-col overflow-hidden">
            {view === 'month' && (
              <MonthView
                currentMonth={currentDate}
                events={events}
                tasks={tasks}
                onSelectDate={(date) => {
                  setSelectedDate(date)
                  setCurrentDate(date)
                  setView('day')
                }}
              />
            )}
            {view === 'week' && <WeekView currentDate={currentDate} events={events} tasks={tasks} />}
            {view === 'day' && <DayView currentDate={currentDate} events={events} tasks={tasks} />}
            {view === 'schedule' && <ScheduleView />}
            {view === 'overdue' && <OverdueView />}
          </div>
        </main>
      </div>
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
