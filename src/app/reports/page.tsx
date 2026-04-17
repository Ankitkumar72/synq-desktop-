"use client"

import { useMemo } from 'react'

import { cn } from "@/lib/utils"
import { 
  Card as UICard, 
  CardContent as UICardContent, 
  CardHeader as UICardHeader, 
  CardTitle as UICardTitle 
} from "@/components/ui/card"
import { AnimatePage } from "@/components/layout/animate-page"
import { useTaskStore } from '@/lib/store/use-task-store'
import { useProjectStore } from '@/lib/store/use-project-store'
import { useNotesStore } from '@/lib/store/use-notes-store'
import { useEventStore } from '@/lib/store/use-event-store'
import { format, subDays, isSameDay, parseISO } from 'date-fns'
import { useHasMounted } from '@/hooks/use-has-mounted'

export default function ReportsPage() {
  const hasMounted = useHasMounted()
  const { tasks } = useTaskStore()
  const { projects } = useProjectStore()
  const { notes } = useNotesStore()
  const { events } = useEventStore()

  // Derived Statistics
  const stats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'done').length
    const finishedEvents = events.filter(e => parseISO(e.end_date) < new Date()).length
    
    // Calculate Streak
    const allCompletions = [
      ...tasks.filter(t => t.status === 'done').map(t => format(parseISO(t.created_at), 'yyyy-MM-dd')),
      ...events.filter(e => parseISO(e.end_date) < new Date()).map(e => format(parseISO(e.end_date), 'yyyy-MM-dd'))
    ]
    const uniqueDays = Array.from(new Set(allCompletions)).sort().reverse()
    let streak = 0
    const checkDate = new Date()
    
    for (const day of uniqueDays) {
      if (day === format(checkDate, 'yyyy-MM-dd')) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    const totalItems = tasks.length + events.length
    const totalDone = completedTasks + finishedEvents
    const productivity = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0

    return [
      { label: "Tasks Completed", value: completedTasks.toString() },
      { label: "Events Finished", value: finishedEvents.toString() },
      { label: "Productivity Score", value: `${productivity}%` },
      { label: "Current Streak", value: `${streak} ${streak === 1 ? 'Day' : 'Days'}` },
    ]
  }, [tasks, events])



  const heatmapData = useMemo(() => {
    const allActivities = [
      ...tasks.map(t => parseISO(t.created_at)),
      ...notes.map(n => parseISO(n.created_at)),
      ...projects.map(p => parseISO(p.created_at))
    ]

    return Array.from({ length: 52 }).map((_, weekIndex) => {
      return Array.from({ length: 7 }).map((_, dayIndex) => {
        const date = subDays(new Date(), (51 - weekIndex) * 7 + (6 - dayIndex))
        return allActivities.filter(d => isSameDay(d, date)).length
      })
    })
  }, [tasks, notes, projects])

  if (!hasMounted) return null

  return (
    <AnimatePage>
      <div className="p-8 space-y-8 max-w-7xl mx-auto text-white">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Reports</h1>
          <p className="text-stone-400 text-sm mt-1">Analyze your team&apos;s productivity and project trajectories.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <UICard key={stat.label} className="border-white/5 shadow-xl bg-[#141414]">
              <UICardContent className="p-6">
                <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">{stat.label}</p>
                <h3 className="text-3xl font-bold tracking-tight text-white">{stat.value}</h3>
              </UICardContent>
            </UICard>
          ))}
        </div>



        <UICard className="border-white/5 shadow-xl bg-[#141414] overflow-hidden">
          <UICardHeader className="p-6"><UICardTitle className="text-sm font-bold text-white">Activity Heatmap</UICardTitle></UICardHeader>
          <UICardContent className="p-6 pt-0">
            <div className="flex gap-1 justify-between h-[100px]">
              {heatmapData.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1 flex-1 max-w-[10px]">
                  {week.map((count, dayIndex) => (
                    <div 
                      key={dayIndex} 
                      className={cn(
                        "w-full pt-[100%] rounded-[2px] transition-all", 
                        count > 5 ? "bg-blue-500" : 
                        count > 2 ? "bg-blue-700" : 
                        count > 0 ? "bg-blue-900/50" : "bg-white/5"
                      )} 
                      title={`Activity count: ${count}`} 
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-6 text-[10px] font-bold text-stone-500 uppercase tracking-widest">
              <span>Last 52 Weeks</span>
              <div className="flex items-center gap-2">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-[1px] bg-white/5" />
                  <div className="w-3 h-3 rounded-[1px] bg-blue-900/50" />
                  <div className="w-3 h-3 rounded-[1px] bg-blue-700" />
                  <div className="w-3 h-3 rounded-[1px] bg-blue-500" />
                </div>
                <span>More</span>
              </div>
            </div>
          </UICardContent>
        </UICard>
      </div>
    </AnimatePage>
  )
}
