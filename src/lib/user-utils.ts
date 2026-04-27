import { User } from '@supabase/supabase-js'

/**
 * Returns a display name for the user based on available metadata or email.
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return "User"
  
  const fullName = user.user_metadata?.full_name
  if (fullName) return fullName

  const email = user.email
  if (email) {
    return email.split('@')[0]
  }

  return "User"
}

/**
 * Returns initials (1-2 characters) for the user.
 */
export function getUserInitials(user: User | null): string {
  const name = getUserDisplayName(user)
  
  if (name === "User") return "U"

  const parts = name.split(/\s+/).filter(Boolean)
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  
  return name[0].toUpperCase()
}
