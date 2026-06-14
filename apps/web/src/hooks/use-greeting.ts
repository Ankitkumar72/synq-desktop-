import { useEffect, useState } from "react"

export function getGreeting(name: string): string {
  const hour = new Date().getHours()
  const firstName = (name || 'Friend').split(' ')[0]
  
  if (hour >= 5 && hour < 12) return `Good morning, ${firstName}`
  if (hour >= 12 && hour < 18) return `Good afternoon, ${firstName}`
  if (hour >= 18 && hour <= 23) return `Good evening, ${firstName}`
  if (hour >= 0 && hour < 4) return `Hello! Welcome, ${firstName}`
  if (hour >= 4 && hour < 5) return `Good morning, ${firstName} — you're up early!`
  
  return `Hello, ${firstName}`
}

export function useGreeting(name: string) {
  const [greeting, setGreeting] = useState(() => getGreeting(name))

  useEffect(() => {
    // Update greeting every minute to handle time transitions
    const interval = setInterval(() => {
      setGreeting(getGreeting(name))
    }, 60000)

    return () => clearInterval(interval)
  }, [name])

  return greeting
}
