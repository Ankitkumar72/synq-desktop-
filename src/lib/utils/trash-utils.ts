import { differenceInDays, addDays, isBefore } from 'date-fns'

const RETENTION_DAYS = 15

/**
 * Calculates how many days are remaining for an item in trash
 * before it is permanently deleted.
 */
export function getDaysRemaining(deletedAt: string | Date | undefined): number {
  if (!deletedAt) return RETENTION_DAYS
  
  const deleteDate = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt
  const expiryDate = addDays(deleteDate, RETENTION_DAYS)
  const today = new Date()
  
  const remaining = differenceInDays(expiryDate, today)
  return Math.max(0, remaining)
}

/**
 * Checks if an item has exceeded the 15-day retention period.
 */
export function isExpired(deletedAt: string | Date | undefined): boolean {
  if (!deletedAt) return false
  
  const deleteDate = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt
  const expiryDate = addDays(deleteDate, RETENTION_DAYS)
  const today = new Date()
  
  return isBefore(expiryDate, today)
}
