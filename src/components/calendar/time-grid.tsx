"use client"

import { useMemo, useEffect, useRef } from "react"
import { 
  startOfDay, 
  endOfDay, 
  eachHourOfInterval, 
  format,
} from "date-fns"

interface TimeGridProps {
  children: React.ReactNode
}

export function TimeGrid({ children }: TimeGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  const hours = useMemo(() => {
    const start = startOfDay(new Date())
    const end = endOfDay(new Date())
    return eachHourOfInterval({ start, end })
  }, [])

  const HOUR_HEIGHT = 48

  useEffect(() => {
    const frame = setTimeout(() => {
      // Auto-scroll to current time on mount
      if (scrollContainerRef.current) {
        const currentHour = new Date().getHours()
        const scrollPosition = Math.max(0, currentHour * HOUR_HEIGHT - 100) // 100px offset for padding
        scrollContainerRef.current.scrollTop = scrollPosition
      }
    }, 0)

    return () => clearTimeout(frame)
  }, [])

  return (
    <div 
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto relative group/grid bg-[#0A0A0A] scrollbar-thin scrollbar-thumb-white/10"
    >
      <div className="flex min-w-full" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
        {/* Time column */}
        <div className="w-16 flex flex-col border-r border-white/10 select-none relative z-20 bg-[#0A0A0A]/95 backdrop-blur-md">
        {hours.map((hour, i) => (
          <div key={i} style={{ height: `${HOUR_HEIGHT}px` }} className="relative shrink-0">
            <span className="absolute -top-[7px] right-2 text-right text-[11px] font-medium text-white tracking-tight uppercase">
              {i === 0 ? "" : format(hour, "h a")}
            </span>
          </div>
        ))}


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
              className="border-b border-white/[0.08] last:border-b-0 relative"
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
    </div>
  )
}
