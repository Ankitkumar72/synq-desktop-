"use client"

import { 
  Check,
  CheckCircle2,
  Clock,
  Layers,
  PlusCircle,
  RefreshCw,
  Trash2,
  ArrowUp,
  Minus,
  ArrowDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useProjectStore } from "@/lib/store/use-project-store"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { Calendar } from "lucide-react"

export function StatCards() {
  const { stats } = useDashboardData()
  const hasMounted = useHasMounted()

  if (!hasMounted) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[110px] w-full rounded-[24px] bg-white/5" />
        ))}
      </div>
    )
  }
  
  const statItems = [
    { 
      label: "Tasks Active", 
      value: stats.tasks.active.toString(), 
      trend: `${stats.tasks.dueToday} due today`, 
      trendingUp: stats.tasks.dueToday > 0 ? false : null,
      icon: CheckCircle2,
      color: "text-blue-500"
    },
    { 
      label: "Evolutions", 
      value: stats.projects.active.toString(), 
      trend: "Projects", 
      trendingUp: null,
      icon: Layers,
      color: "text-emerald-500"
    },
    { 
      label: "Today's Schedule", 
      value: stats.events.today.toString(), 
      trend: stats.events.upcoming > 0 ? `${stats.events.upcoming} upcoming` : "Clear day", 
      trendingUp: null,
      icon: Clock,
      color: "text-amber-500"
    },
    { 
      label: "Insights", 
      value: stats.notes.total.toString(), 
      trend: stats.notes.pinned > 0 ? `${stats.notes.pinned} pinned` : "Total notes", 
      trendingUp: true,
      icon: CheckCircle2,
      color: "text-indigo-500"
    },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {statItems.map((stat, idx) => (
        <motion.div 
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: idx * 0.1 }}
          className="zen-card p-6 group cursor-default"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-stone-500 font-sans">
                {stat.label}
              </span>
              <stat.icon className={cn("w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity", stat.color)} />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-extrabold tracking-tighter text-stone-100 font-display leading-none">
                {stat.value}
              </span>
              {stat.trend && (
                <span className={cn(
                  "text-[10px] font-bold tracking-tight px-2 py-1 rounded-full",
                  stat.trendingUp === true ? "bg-emerald-500/10 text-emerald-400" : 
                  stat.trendingUp === false ? "bg-rose-500/10 text-rose-400" :
                  "bg-white/5 text-stone-400"
                )}>
                  {stat.trend}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export function MyTasksWidget() {
  const { nextActions } = useDashboardData()
  const { updateTask } = useTaskStore()
  const hasMounted = useHasMounted()

  if (!hasMounted) return <Skeleton className="h-[400px] w-full rounded-[24px] bg-white/5" />

  return (
    <div className="zen-card overflow-hidden h-full flex flex-col">
      <div className="p-6 flex items-center justify-between">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-stone-500">Next Actions</h3>
        <span className="text-[11px] font-bold text-stone-100/40 cursor-pointer hover:text-stone-100 transition-colors">Full view</span>
      </div>
      <div className="flex-1">
        {nextActions.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center">
              <Check className="w-5 h-5 text-stone-600" />
            </div>
            <div className="space-y-1">
              <p className="text-[15px] font-bold text-stone-100 font-display">Zen state achieved</p>
              <p className="text-[12px] text-stone-500 font-medium tracking-tight px-4">All priority tasks and events are cleared.</p>
            </div>
          </div>
        ) : (
          <div className="px-3 pb-6 space-y-1">
            {nextActions.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-[18px] transition-all group cursor-pointer"
                onClick={() => {
                  if (item.type === 'task') {
                    updateTask(item.id, { status: 'done' })
                  }
                }}
              >
                <div className={cn(
                  "zen-checkbox transition-all group-hover:scale-110",
                  item.type === 'event' ? "border-amber-500/20 bg-amber-500/5" : "border-white/10"
                )}>
                  {item.type === 'event' ? (
                    <Calendar className="w-2.5 h-2.5 text-amber-500" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-blue-500 scale-0 group-hover:scale-100 transition-all duration-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-stone-200 truncate leading-tight group-hover:text-white tracking-tight">{item.title}</p>
                  <p className="text-[10px] font-extrabold text-stone-600 mt-1 uppercase tracking-[0.1em]">
                    {item.type === 'event' ? (
                      <span className="text-amber-500/70">Scheduled Action</span>
                    ) : (
                      item.project_id ? 'In Evolution' : 'Direct Action'
                    )}
                  </p>
                </div>
                {item.type === 'task' ? (
                  item.priority === 'high' ? (
                    <ArrowUp className="w-3.5 h-3.5 text-rose-500" strokeWidth={3} />
                  ) : item.priority === 'medium' ? (
                    <Minus className="w-3.5 h-3.5 text-amber-500" strokeWidth={3} />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-stone-600" strokeWidth={3} />
                  )
                ) : (
                  <Clock className="w-3.5 h-3.5 text-amber-500/50" strokeWidth={3} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


import { useState, useEffect } from "react"
import { Activity as ActivityType } from "@/types"
import { supabase } from "@/lib/supabase.client"

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityType[]>([])
  const hasMounted = useHasMounted()

  useEffect(() => {
    if (!hasMounted || !supabase) return

    const fetchActivities = async () => {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6)
      if (data) setActivities(data)
    }

    fetchActivities()

    const channel = supabase
      .channel('public:activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, () => {
        fetchActivities()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [hasMounted])

  if (!hasMounted) return <Skeleton className="h-[450px] w-full rounded-[24px] bg-white/5" />

  return (
    <div className="zen-card overflow-hidden h-full">
      <div className="p-6">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-stone-500 mb-8">Timeline</h3>
        <div className="space-y-8 relative">
          {/* Vertical line connector */}
          <div className="absolute left-[14px] top-4 bottom-4 w-[1px] bg-white/5" />
          
          {activities.length === 0 ? (
            <p className="text-[13px] text-stone-600 font-medium">Listening for updates...</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex gap-4 group relative z-10">
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border-2 border-white/5 flex items-center justify-center shrink-0 group-hover:border-stone-100 transition-all shadow-lg overflow-hidden">
                  {activity.action === 'created' ? (
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                  ) : activity.action === 'deleted' ? (
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  ) : activity.action === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[13.5px] text-stone-400 leading-snug font-medium">
                    <span className="font-bold text-stone-100">{activity.user_name}</span> {activity.action} <span className="text-stone-100 font-bold">{activity.target_type}</span>
                  </p>
                  <p className="text-[10px] font-extrabold text-stone-700 mt-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function ProjectProgress() {
  const { projects } = useProjectStore()
  const { tasks } = useTaskStore()
  const hasMounted = useHasMounted()

  if (!hasMounted) return <Skeleton className="h-[250px] w-full rounded-[24px] bg-white/5" />

  return (
    <div className="zen-card overflow-hidden h-full">
      <div className="p-6">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-stone-500 mb-8">Evolution</h3>
        <div className="space-y-8">
          {projects.slice(0, 3).map((project) => {
            const projectTasks = tasks.filter(t => t.project_id === project.id && !t.deleted_at)
            const completedCount = projectTasks.filter(t => t.status === 'done').length
            const totalCount = projectTasks.length
            const realProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : project.progress

            return (
              <div key={project.id} className="space-y-3 group cursor-default">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-stone-200 group-hover:text-white transition-colors font-display tracking-tight">{project.name}</span>
                  <span className="text-[11px] font-black text-stone-100 font-sans tracking-tighter bg-white/5 px-2 py-0.5 rounded-md">{realProgress}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden p-[1.5px]">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${realProgress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full shadow-[0_1px_8px_rgba(0,0,0,0.3)] rounded-full", project.id === 'personal' ? 'bg-blue-500' : 'bg-emerald-500')} 
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
