export function formatRelativeDate(dateInput?: string | Date | null): string {
  if (!dateInput) return 'Recently'
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  
  // Handle invalid date objects (new Date(undefined) or new Date('garbage'))
  if (isNaN(date.getTime())) return 'Recently'
  
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  // Future dates or negative diff (can happen due to clock sync)
  if (diffInSeconds < 0) return 'Just now'

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
