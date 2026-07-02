import { useMemo, useRef } from "react"
import { startOfYear, addMonths, startOfMonth, startOfWeek, eachDayOfInterval, addDays, isSameMonth, isSameDay, format } from "date-fns"
import { cn } from "@/lib/utils"

interface YearViewProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevYear: () => void;
  onNextYear: () => void;
}

export function YearView({ currentDate, onSelectDate, onPrevYear, onNextYear }: YearViewProps) {
  const months = useMemo(() => {
    const start = startOfYear(currentDate);
    return Array.from({ length: 12 }, (_, i) => addMonths(start, i));
  }, [currentDate]);

  const accumulatedDelta = useRef(0);
  const isCooldown = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (isCooldown.current) return;
    // Ignore mostly vertical scrolling
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;

    accumulatedDelta.current += e.deltaX;

    if (Math.abs(accumulatedDelta.current) > 50) {
      if (accumulatedDelta.current > 0) {
        onNextYear();
      } else {
        onPrevYear();
      }
      
      accumulatedDelta.current = 0;
      isCooldown.current = true;
      
      setTimeout(() => {
        isCooldown.current = false;
      }, 600); // 600ms cooldown to prevent rapid skipping
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      accumulatedDelta.current = 0;
    }, 150);
  };

  return (
    <div 
      className="flex-1 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-700 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
      onWheel={handleWheel}
    >
      <div className="min-h-full flex flex-col justify-center p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 lg:gap-x-12 gap-y-4 lg:gap-y-6 max-w-[1400px] w-full mx-auto">
          {months.map((month, idx) => (
            <MonthBlock key={idx} monthDate={month} onSelectDate={onSelectDate} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MonthBlock({ monthDate, onSelectDate }: { monthDate: Date, onSelectDate: (date: Date) => void }) {
  const grid = useMemo(() => {
    const start = startOfMonth(monthDate)
    const gridStart = startOfWeek(start)
    return eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) }).slice(0, 42)
  }, [monthDate])

  const daysShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="flex flex-col select-none w-fit mx-auto">
      <h3 className="text-[14px] font-semibold text-stone-200 mb-1.5 pl-1.5">
        {format(monthDate, 'MMMM')}
      </h3>
      <div className="grid grid-cols-7 mb-1">
        {daysShort.map((day, i) => (
          <div key={i} className="text-[11px] font-bold text-stone-500 text-center w-8 h-5 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((date, i) => {
          const isCurrentMonth = isSameMonth(date, monthDate)
          const isToday = isSameDay(date, new Date())

          return (
            <div
              key={i}
              className="w-8 h-8 flex items-center justify-center"
            >
              <div 
                onClick={() => onSelectDate(date)}
                className={cn(
                  "h-7 w-7 text-[13px] flex items-center justify-center rounded-full cursor-pointer transition-all",
                  !isCurrentMonth ? "text-stone-700 hover:text-white hover:bg-white/10" :
                  isToday
                    ? "bg-white text-black font-bold shadow-sm"
                    : "text-stone-300 hover:text-white hover:bg-white/10"
                )}
              >
                {format(date, 'd')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
