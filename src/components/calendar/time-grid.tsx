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
  hourHeight?: number
  header?: React.ReactNode
}

export function TimeGrid({ children, hourHeight = 48, header }: TimeGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const d = new Date()
      d.setHours(i, 0, 0, 0)
      return d
    })
  }, [])

  const HOUR_HEIGHT = hourHeight

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
  }, [HOUR_HEIGHT])

  return (
    <div 
      ref={scrollContainerRef}
      className="time-grid-scroll flex-1 overflow-y-auto relative group/grid bg-[#0A0A0A] scrollbar-thin scrollbar-thumb-white/10"
    >
      {header && (
        <div className="sticky top-0 z-40">
          {header}
        </div>
      )}
      <div className="flex min-w-full" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
        {/* Time column */}
        <div className="w-14 flex flex-col border-r border-white/10 select-none relative z-20 bg-[#0A0A0A]/95 backdrop-blur-md">
        {hours.map((hour, i) => (
          <div key={i} className="relative shrink-0 flex-1">
            <span className="absolute -top-[8px] right-2.5 text-right text-[10px] font-semibold text-stone-500 tracking-wider uppercase">
              {i === 0 ? "" : format(hour, "h a")}
            </span>
          </div>
        ))}
        </div>

      {/* Grid content */}
      <div className="flex-1 relative">
        <div 
          className="absolute inset-0 pointer-events-none flex flex-col"
        >
          {hours.map((_, i) => (
            <div 
              key={i} 
              className="border-b border-white/[0.04] relative flex-1"
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
