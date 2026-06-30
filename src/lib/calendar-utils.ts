import { 
  startOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  subDays,
  format,
  subMonths,
  addMonths,
  addWeeks,
  subWeeks,
  startOfDay,
  endOfDay,
  eachHourOfInterval,
  isSameHour
} from 'date-fns'

export const generateCalendarGrid = (currentDate: Date) => {
  const start = startOfMonth(currentDate)
  const gridStart = startOfWeek(start)
  const gridEnd = endOfWeek(addDays(gridStart, 41)) // Ensure 6 weeks (42 days)

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).slice(0, 42)
}

export { isSameMonth, isSameDay, format, subMonths, addMonths, startOfMonth, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfDay, endOfDay, eachHourOfInterval, isSameHour, addDays, subDays }

export const getMonthYearString = (date: Date) => format(date, 'MMMM yyyy')
export const getDayString = (date: Date) => format(date, 'd')
export const getDayOfWeekHeader = (date: Date) => format(date, 'EEE')

export const getWeekRangeString = (date: Date) => {
  const start = startOfWeek(date)
  const end = endOfWeek(date)
  
  if (isSameMonth(start, end)) {
    return format(start, 'MMM yyyy')
  }
  
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM')} - ${format(end, 'MMM yyyy')}`
  }
  
  return `${format(start, 'MMM yyyy')} - ${format(end, 'MMM yyyy')}`
}

export const getDayFullString = (date: Date) => format(date, 'EEEE, MMMM d, yyyy')
export const getTimeString = (date: Date) => format(date, 'HH:mm')
