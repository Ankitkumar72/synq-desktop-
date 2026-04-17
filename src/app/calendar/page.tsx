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
  LayoutGrid,
  Columns,
  Square,
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
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
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
    return getDayFullString(currentDate)
  }


  return (
    <AnimatePage>
      <div className="flex h-screen bg-[#0A0A0A] text-[#f2f2F2] overflow-hidden font-sans selection:bg-blue-500/30">
        <aside className="w-72 border-r border-white/5 flex flex-col pt-6 px-4 bg-[#0e0e0e] shrink-0 z-10">
          <div className="px-2 mb-8">
            <QuickCreateModal 
              defaultType="event"
              trigger={
                <Button 
                  className="w-full h-12 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] border-none"
                >
                  <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                  <span className="text-sm font-bold tracking-tight">Create event</span>
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
          <header className="h-16 border-b border-white/5 flex items-center px-8 justify-between bg-background/50 backdrop-blur-xl z-20 shrink-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleToday}
                  className="h-9 px-5 rounded-xl font-bold text-[12px] uppercase tracking-wider bg-white/[0.03] border-white/5 hover:bg-white/[0.07] text-stone-400 hover:text-white transition-all shadow-none"
                >
                  Today
                </Button>
                <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-0.5 border border-white/5">
                  <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 text-stone-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 text-stone-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <h2 className="text-xl font-display font-black tracking-tight text-white ml-2">
                  {getHeaderTitle()}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-1.5 cursor-pointer hover:bg-white/5 transition-all outline-none">
                      <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">{view}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-stone-600" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="bg-[#0e0e0e] border-white/5 text-stone-400 min-w-[140px] rounded-xl overflow-hidden shadow-2xl backdrop-blur-xl p-1">
                  <DropdownMenuItem onClick={() => setView('month')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 hover:text-white cursor-pointer transition-all">
                    <LayoutGrid className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Month</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('week')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 hover:text-white cursor-pointer transition-all">
                    <Columns className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Week</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('day')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 hover:text-white cursor-pointer transition-all">
                    <Square className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Day</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="h-6 w-px bg-white/5" />
              <div className="flex items-center gap-1">
                {[Search, Settings, HelpCircle].map((Icon, idx) => (
                  <Button key={idx} variant="ghost" size="icon" className="h-9 w-9 text-stone-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
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
      <div className="flex items-center justify-between mb-4 px-2">
        <span className="text-[12px] font-black text-stone-200 uppercase tracking-wider">
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-600 hover:text-white hover:bg-white/5 rounded-lg" onClick={() => onViewDateChange(subMonths(viewDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-600 hover:text-white hover:bg-white/5 rounded-lg" onClick={() => onViewDateChange(addMonths(viewDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {daysShort.map((day, i) => (
          <div key={i} className="text-[10px] font-black text-stone-700 text-center h-7 flex items-center justify-center uppercase">
            {day}
          </div>
        ))}
        {grid.map((date, i) => {
          const isSelected = isSameDay(date, selectedDate)
          const isCurrentMonth = isSameMonth(date, viewDate)
          const isToday = isSameDay(date, new Date())

          return (
            <div 
              key={i}
              onClick={() => onSelectDate(date)}
              className={cn(
                "h-8 w-8 text-[11px] font-bold rounded-xl flex items-center justify-center cursor-pointer transition-all mx-auto",
                isSelected && "bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]",
                isToday && !isSelected && "bg-white/10 text-blue-400 border border-blue-500/30",
                !isSelected && !isToday && isCurrentMonth && "text-stone-400 hover:text-white hover:bg-white/5",
                !isSelected && !isToday && !isCurrentMonth && "text-stone-800 hover:text-stone-600"
              )}
            >
              {format(date, 'd')}
            </div>
          )
        })}
      </div>
    </div>
  )
}
