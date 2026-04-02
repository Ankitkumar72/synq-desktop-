"use client"

import { 
  CheckSquare, 
  FolderKanban, 
  MessageSquare, 
  Users,
  Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useProjectStore } from "@/lib/store/use-project-store"
import { useHasMounted } from "@/hooks/use-has-mounted"

export function StatCards() {
  const { tasks } = useTaskStore()
  const { projects } = useProjectStore()
  const hasMounted = useHasMounted()

  if (!hasMounted) return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 h-[100px]" />
  
  const stats = [
    { label: "Total Tasks", value: tasks.length.toString(), trend: "+2", trendingUp: true, icon: CheckSquare },
    { label: "Active Projects", value: projects.length.toString(), trend: "0", trendingUp: null, icon: FolderKanban },
    { label: "Due Today", value: tasks.filter(t => t.due_date === 'Today').length.toString(), trend: "-3", trendingUp: false, icon: Users },
    { label: "Completed", value: tasks.filter(t => t.status === 'done').length.toString(), trend: "+12", trendingUp: true, icon: MessageSquare },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white border border-stone-200/60 rounded-[12px] p-5 transition-all shadow-sm hover:shadow-md hover:border-stone-300/60 group">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-1">
              {stat.label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tighter text-stone-900">
                {stat.value}
              </span>
              {stat.trendingUp !== null && (
                <div className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-tight",
                  stat.trendingUp === true ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {stat.trend}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function MyTasksWidget() {
  const { tasks } = useTaskStore()
  const hasMounted = useHasMounted()
  const priorityTasks = tasks.filter(t => t.status !== 'done' && !t.deleted_at).slice(0, 5)

  if (!hasMounted) return <div className="bg-white border border-stone-100 rounded-[12px] h-[300px]" />

  return (
    <div className="bg-white border border-stone-200/60 rounded-[12px] overflow-hidden h-full shadow-sm">
      <div className="p-5 border-b border-stone-50 flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">Priority Tasks</h3>
        <span className="text-[10px] font-semibold text-stone-900 cursor-pointer hover:underline underline-offset-4 transition-all tracking-tight">View all</span>
      </div>
      <div className="divide-y divide-stone-50">
        {priorityTasks.length === 0 ? (
          <div className="p-10 text-center space-y-1">
            <p className="text-[13px] font-semibold text-stone-900">All caught up!</p>
            <p className="text-[11px] text-stone-400">No pending tasks for now.</p>
          </div>
        ) : (
          priorityTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-4 p-4 hover:bg-stone-50/50 transition-all group">
              <div className="w-4 h-4 rounded border border-stone-200 flex items-center justify-center bg-white group-hover:border-[#6366f1] transition-all cursor-pointer">
                <div className="w-2 h-2 rounded-sm bg-stone-50 group-hover:bg-[#6366f1] transition-all" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-stone-900 truncate leading-tight">{task.title}</p>
                <p className="text-[10px] font-medium text-stone-400 mt-0.5">{task.project_id || 'Personal'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-tight",
                  task.priority === 'high' ? "bg-rose-50 text-rose-600" : 
                  task.priority === 'medium' ? "bg-amber-50 text-amber-600" : "bg-stone-50 text-stone-400"
                )}>
                  {task.priority}
                </span>
                <span className="text-[9px] font-medium text-stone-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {task.due_date}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from "react"
import { Activity } from "@/types"
import { supabase } from "@/lib/supabase.client"

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([])
  const hasMounted = useHasMounted()

  useEffect(() => {
    if (!hasMounted || !supabase) return

    const fetchActivities = async () => {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
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

  if (!hasMounted) return <div className="bg-white border border-stone-100 rounded-[12px] h-[400px]" />

  return (
    <div className="bg-white border border-stone-200/60 rounded-[12px] overflow-hidden h-full shadow-sm">
      <div className="p-5 border-b border-stone-50">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">Activity</h3>
      </div>
      <div className="p-5">
        <div className="space-y-5">
          {activities.length === 0 ? (
            <p className="text-[12px] text-stone-400">No recent activity.</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center text-[9px] font-bold text-stone-500 shrink-0">
                  {activity.user_name?.substring(0, 2).toUpperCase() || "??"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-stone-500 leading-tight">
                    <span className="font-semibold text-stone-900">{activity.user_name}</span> {activity.action} <span className="text-stone-900 font-medium">{activity.target_type}</span>
                  </p>
                  <p className="text-[9px] font-medium text-stone-300 mt-1">
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
  const hasMounted = useHasMounted()

  if (!hasMounted) return <div className="bg-white border border-stone-100 rounded-[12px] h-[200px]" />

  return (
    <div className="bg-white border border-stone-200/60 rounded-[12px] overflow-hidden h-full shadow-sm">
      <div className="p-5 border-b border-stone-50">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">Progress</h3>
      </div>
      <div className="p-5 space-y-5">
        {projects.map((project) => (
          <div key={project.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-stone-900">{project.name}</span>
              <span className="text-[11px] font-medium text-stone-400 font-mono">{project.progress}%</span>
            </div>
            <div className="h-1 bg-stone-50 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", project.color)} 
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
