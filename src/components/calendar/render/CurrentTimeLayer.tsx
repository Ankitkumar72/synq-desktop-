import { useEffect, useState, useMemo } from "react"
import { isSameDay } from "date-fns"

interface CurrentTimeLayerProps {
  currentDate: Date | null // null means it's a week view, so it always renders if today is in the week, but wait, week view can just pass the start of the week, but usually current time layer spans all columns.
  hourHeight: number
  isWeekView?: boolean
}

export function CurrentTimeLayer({ currentDate, hourHeight, isWeekView }: CurrentTimeLayerProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    // Sync to the start of the next minute for precise updates
    const msToNextMinute = 60000 - (now.getTime() % 60000)
    
    let timer: NodeJS.Timeout
    const initialTimer = setTimeout(() => {
      setNow(new Date())
      timer = setInterval(() => setNow(new Date()), 60000)
    }, msToNextMinute)

    return () => {
      clearTimeout(initialTimer)
      if (timer) clearInterval(timer)
    }
  }, [now])

  const currentTimeTop = useMemo(() => {
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    return (minutesSinceMidnight / 60) * hourHeight
  }, [now, hourHeight])

  // Determine if we should render the line
  // If isWeekView is true, we always render the line because week view spans all days (and the red line can just stretch across).
  // Actually, wait. In week view, the line should ideally only appear in the column for *today*, or it can stretch across the entire grid but that might look weird if it crosses days in the future. 
  // Let's just make it a line that crosses the entire grid. Morgen uses a line that crosses the whole view.

  const shouldRender = isWeekView || (currentDate && isSameDay(currentDate, new Date()))

  if (!shouldRender) return null

  return (
    <div 
      className="absolute left-0 right-0 h-px bg-[#ef4444] z-40 pointer-events-none flex items-center"
      style={{ top: `${currentTimeTop}px` }}
    >
      {/* Indicator Dot */}
      <div className="w-2 h-2 rounded-full bg-[#ef4444] -ml-1 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
    </div>
  )
}
