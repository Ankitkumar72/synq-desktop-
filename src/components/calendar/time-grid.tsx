"use client"

import { useMemo, useEffect, useState } from "react"
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
  const hours = useMemo(() => {
    const start = startOfDay(new Date())
    const end = endOfDay(new Date())
    return eachHourOfInterval({ start, end })
  }, [])

  const [now, setNow] = useState(new Date())
  const HOUR_HEIGHT = 80

  useEffect(() => {
    if (!showCurrentTime) return
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [showCurrentTime])

  const currentTimeTop = useMemo(() => {
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    return (minutesSinceMidnight / 60) * HOUR_HEIGHT
  }, [now])

  return (
    <div className="flex-1 flex overflow-hidden relative group/grid">
      {/* Time column */}
      <div className="w-16 flex flex-col border-r border-white/5 select-none bg-[#0e0e0e]/50 backdrop-blur-md">
        {hours.map((hour, i) => (
          <div key={i} style={{ height: `${HOUR_HEIGHT}px` }} className="relative px-2 shrink-0">
            <span className="absolute -top-2 left-0 right-0 text-center text-[10px] font-black text-stone-600 uppercase tracking-tighter">
              {i === 0 ? "" : format(hour, "h aa")}
            </span>
          </div>
        ))}
      </div>

      {/* Grid content */}
      <div className="flex-1 relative overflow-y-auto scrollbar-none bg-[#0A0A0A]">
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

        {/* Current time indicator */}
        {showCurrentTime && (
          <div 
            className="absolute left-0 right-0 z-40 flex items-center pointer-events-none"
            style={{ top: `${currentTimeTop}px` }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] -ml-1" />
            <div className="flex-1 h-px bg-red-500/50 shadow-[0_0_5px_rgba(239,68,68,0.3)]" />
          </div>
        )}

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
