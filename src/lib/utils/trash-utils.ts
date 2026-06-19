import { differenceInDays, addDays, isBefore } from 'date-fns'

const RETENTION_DAYS = 14


export function getDaysRemaining(deletedAt: string | Date | undefined): number {
  if (!deletedAt) return RETENTION_DAYS

  const deleteDate = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt
  const expiryDate = addDays(deleteDate, RETENTION_DAYS)
  const today = new Date()

  const remaining = differenceInDays(expiryDate, today)
  return Math.max(0, remaining)
}


export function isExpired(deletedAt: string | Date | undefined): boolean {
  if (!deletedAt) return false

  const deleteDate = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt
  const expiryDate = addDays(deleteDate, RETENTION_DAYS)
  const today = new Date()

  return isBefore(expiryDate, today)
}
