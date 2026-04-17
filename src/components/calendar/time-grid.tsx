"use client"

import { useMemo, useEffect, useState, useRef } from "react"
import { 
  startOfDay, 
  endOfDay, 
  eachHourOfInterval, 
  format,
} from "date-fns"

interface TimeGridProps {
  children: React.ReactNode
  showCurrentTime?: boolean
}

export function TimeGrid({ children, showCurrentTime = true }: TimeGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  const hours = useMemo(() => {
    const start = startOfDay(new Date())
    const end = endOfDay(new Date())
    return eachHourOfInterval({ start, end })
  }, [])

  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const HOUR_HEIGHT = 80

  useEffect(() => {
    const frame = setTimeout(() => {
      setMounted(true)
      
      // Auto-scroll to current time on mount
      if (scrollContainerRef.current) {
        const currentHour = new Date().getHours()
        const scrollPosition = Math.max(0, currentHour * HOUR_HEIGHT - 100) // 100px offset for padding
        scrollContainerRef.current.scrollTop = scrollPosition
      }
    }, 0)

    if (!showCurrentTime) return () => clearTimeout(frame)
    
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => {
      clearTimeout(frame)
      clearInterval(timer)
    }
  }, [showCurrentTime])

  const currentTimeTop = useMemo(() => {
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    return (minutesSinceMidnight / 60) * HOUR_HEIGHT
  }, [now])

  return (
    <div 
      ref={scrollContainerRef}
      className="flex-1 flex overflow-y-auto relative group/grid bg-[#0A0A0A] scrollbar-thin scrollbar-thumb-white/10"
    >
      {/* Time column */}
      <div className="w-16 flex flex-col border-r border-white/5 select-none relative z-20 bg-[#0A0A0A]/80 backdrop-blur-sm">
        {hours.map((hour, i) => (
          <div key={i} style={{ height: `${HOUR_HEIGHT}px` }} className="relative px-2 shrink-0">
            <span className="absolute -top-[7px] right-2 text-right text-[10px] font-medium text-stone-600 tracking-tight uppercase">
              {i === 0 ? "" : format(hour, "HH:mm")}
            </span>
          </div>
        ))}

        {/* Current time pill */}
        {mounted && showCurrentTime && (
          <div 
            className="absolute left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-all"
            style={{ top: `${currentTimeTop}px`, marginTop: '-8px' }}
          >
            <div className="bg-[#ef4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] shadow-lg shadow-black/20 tracking-tighter">
              {format(now, "HH:mm")}
            </div>
          </div>
        )}
      </div>

      {/* Grid content */}
      <div className="flex-1 relative">
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ height: `${24 * HOUR_HEIGHT}px` }}
        >
          {hours.map((_, i) => (
            <div 
              key={i} 
              style={{ height: `${HOUR_HEIGHT}px` }}
              className="border-b border-white/[0.03] last:border-b-0"
            />
          ))}
        </div>

        {/* The day/week columns */}
        <div 
          className="absolute inset-0 flex"
          style={{ height: `${24 * HOUR_HEIGHT}px` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
