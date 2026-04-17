"use client"

import { useState, useEffect, useMemo } from 'react'
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts'
import { 
  Calendar, 
  Download, 
  MoreHorizontal, 
  TrendingUp,
  Activity,
  CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  const [showCharts, setShowCharts] = useState(false)
  const { tasks } = useTaskStore()
  const { projects } = useProjectStore()
  const { notes } = useNotesStore()
  const { events } = useEventStore()

  useEffect(() => {
    const timer = setTimeout(() => setShowCharts(true), 250)
    return () => clearTimeout(timer)
  }, [])

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
      { label: "Tasks Completed", value: completedTasks.toString(), trend: `+${tasks.filter(t => t.status === 'done' && isSameDay(parseISO(t.created_at), new Date())).length}`, icon: CheckCircle2, color: "text-blue-500" },
      { label: "Events Finished", value: finishedEvents.toString(), trend: `+${events.filter(e => parseISO(e.end_date) < new Date() && isSameDay(parseISO(e.end_date), new Date())).length}`, icon: Calendar, color: "text-emerald-500" },
      { label: "Productivity Score", value: `${productivity}%`, trend: streak > 0 ? "On Fire" : "Starting", icon: Activity, color: "text-amber-500" },
      { label: "Current Streak", value: `${streak} Days`, trend: "+1", icon: TrendingUp, color: "text-stone-500" },
    ]
  }, [tasks, events])

  const completionData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i)
      const dayTasks = tasks.filter(t => isSameDay(parseISO(t.created_at), date))
      return {
        name: format(date, 'eee'),
        completed: dayTasks.filter(t => t.status === 'done').length,
        total: dayTasks.length
      }
    })
  }, [tasks])

  const projectData = useMemo(() => {
    const statusCounts = {
      'on-track': projects.filter(p => (p.status || 'on-track') === 'on-track').length,
      'at-risk': projects.filter(p => p.status === 'at-risk').length,
      'overdue': projects.filter(p => p.status === 'overdue').length,
      'completed': projects.filter(p => p.progress === 100).length
    }

    return [
      { name: 'On Track', value: statusCounts['on-track'], color: '#10b981' },
      { name: 'At Risk', value: statusCounts['at-risk'], color: '#f59e0b' },
      { name: 'Overdue', value: statusCounts['overdue'], color: '#ef4444' },
      { name: 'Completed', value: statusCounts['completed'], color: '#3b82f6' },
    ].filter(d => d.value > 0)
  }, [projects])

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
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Reports</h1>
            <p className="text-stone-400 text-sm">Analyze your team&apos;s productivity and project trajectories.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 border-white/5 bg-white/5 text-stone-400 hover:text-white gap-2">
              <Calendar className="w-4 h-4" /> Last 30 Days
            </Button>
            <Button variant="outline" size="sm" className="h-9 border-white/5 bg-white/5 text-stone-400 hover:text-white gap-2">
              <Download className="w-4 h-4" /> Export
            </Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700 h-9 rounded-full px-4 font-medium transition-colors">
              Generate Report
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <UICard key={stat.label} className="border-white/5 shadow-xl bg-[#141414]">
              <UICardContent className="p-6 flex items-center gap-4">
                <div className={cn("p-2 rounded-lg bg-white/5", stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{stat.label}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-bold tracking-tight text-white">{stat.value}</h3>
                    <span className={cn(
                      "text-[10px] font-bold px-1 py-0.5 rounded",
                      stat.trend.startsWith('+') ? "bg-emerald-500/10 text-emerald-500" : 
                      stat.trend.startsWith('-') ? "bg-rose-500/10 text-rose-500" : "bg-white/5 text-stone-400"
                    )}>
                      {stat.trend}
                    </span>
                  </div>
                </div>
              </UICardContent>
            </UICard>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <UICard className="lg:col-span-2 border-white/5 shadow-xl bg-[#141414]">
            <UICardHeader className="p-6 flex flex-row items-center justify-between space-y-0">
              <UICardTitle className="text-sm font-bold text-white">Task Completion Trend</UICardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-600 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </UICardHeader>
            <UICardContent className="p-6 pt-0">
              <div className="h-[300px] w-full mt-4 min-w-0">
                {showCharts ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={completionData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#78716c' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          borderRadius: '12px', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          fontSize: '12px',
                          color: '#fff'
                        }} 
                        itemStyle={{ color: '#fff' }}
                      />
                      <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', stroke: '#000', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="total" stroke="rgba(255,255,255,0.1)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full bg-white/5 animate-pulse rounded-lg" />}
              </div>
            </UICardContent>
          </UICard>

          <UICard className="border-white/5 shadow-xl bg-[#141414]">
            <UICardHeader className="p-6 flex flex-row items-center justify-between space-y-0 text-white">
              <UICardTitle className="text-sm font-bold">Project Distribution</UICardTitle>
            </UICardHeader>
            <UICardContent className="p-6 pt-0 text-center">
              <div className="h-[240px] w-full relative min-w-0">
                {showCharts ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie data={projectData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {projectData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          borderRadius: '12px', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full bg-white/5 animate-pulse rounded-lg" />}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <p className="text-2xl font-bold leading-none text-white">{projects.length}</p>
                  <p className="text-[10px] font-bold text-stone-500 tracking-wider">PROJECTS</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {projectData.length > 0 ? projectData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-stone-400 font-medium">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-white">
                      {Math.round((item.value / projects.length) * 100)}%
                    </span>
                  </div>
                )) : <p className="text-xs text-stone-600 py-4 font-medium">No project data</p>}
              </div>
            </UICardContent>
          </UICard>
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
