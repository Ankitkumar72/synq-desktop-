"use client"

import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatePage } from "@/components/layout/animate-page"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useEventStore } from "@/lib/store/use-event-store"
import { useHasMounted } from "@/hooks/use-has-mounted"

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const { addEvent } = useEventStore()
  const hasMounted = useHasMounted()

  if (!hasMounted) return null

  const handleAddEvent = async () => {
    await addEvent({
      title: "New Team Sync",
      start_date: new Date().toISOString(),
      end_date: new Date().toISOString(),
      color: "bg-indigo-500",
      description: "Auto-generated sync event"
    })
    alert("Check the Trash page later to see event deletion!")
  }

  return (
    <AnimatePage>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Calendar</h1>
            <p className="text-stone-500 text-sm">Schedule and manage your team events.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-stone-100 p-1 rounded-md flex items-center">
              <Button variant="outline" size="sm" className="h-7 px-3 rounded-sm text-xs bg-white shadow-sm font-bold text-black border-stone-200">
                Month
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-3 rounded-sm text-xs text-stone-500 font-medium hover:text-black">
                Week
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-3 rounded-sm text-xs text-stone-500 font-medium hover:text-black">
                Day
              </Button>
            </div>
            <Button 
              onClick={handleAddEvent}
              className="bg-black text-white hover:bg-stone-800 h-9 rounded-full px-4 gap-2 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </Button>
          </div>
        </div>

        <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden min-h-[600px] flex flex-col">
          <div className="p-6 border-b border-stone-50 flex items-center justify-between bg-stone-50/30">
            <h2 className="text-lg font-bold text-stone-900">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-stone-400 hover:text-black hover:bg-white rounded-full transition-all"
                onClick={() => {
                  const newDate = new Date(currentDate)
                  newDate.setMonth(newDate.getMonth() - 1)
                  setCurrentDate(newDate)
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-xs font-bold text-stone-900 hover:bg-white rounded-lg"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-stone-400 hover:text-black hover:bg-white rounded-full transition-all"
                onClick={() => {
                  const newDate = new Date(currentDate)
                  newDate.setMonth(newDate.getMonth() + 1)
                  setCurrentDate(newDate)
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-7 divide-x divide-stone-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-stone-300 border-b border-stone-50">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[120px] p-2 border-b border-stone-50 hover:bg-stone-50/30 transition-colors group">
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "w-7 h-7 flex items-center justify-center text-xs font-bold rounded-full transition-all",
                    i === 15 ? "bg-black text-white shadow-lg" : "text-stone-400 group-hover:text-stone-900"
                  )}>
                    {i + 1 > 31 ? (i + 1) % 31 : i + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimatePage>
  )
}
