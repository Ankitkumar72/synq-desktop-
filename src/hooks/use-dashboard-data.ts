"use client"

import { useMemo } from "react"
import { isToday, parseISO, isAfter } from "date-fns"
import { useTaskStore } from "@/lib/store/use-task-store"
import { useNotesStore } from "@/lib/store/use-notes-store"
import { useEventStore } from "@/lib/store/use-event-store"
import { useProjectStore } from "@/lib/store/use-project-store"

export function useDashboardData() {
  const { tasks } = useTaskStore()
  const { notes } = useNotesStore()
  const { events } = useEventStore()
  const { projects } = useProjectStore()

  return useMemo(() => {
    // Filter out deleted items
    const activeTasks = tasks.filter(t => !t.deleted_at)
    const activeNotes = notes.filter(n => !n.deleted_at)
    const activeEvents = events.filter(e => !e.deleted_at)

    // Task calculations
    const todoTasks = activeTasks.filter(t => t.status !== 'done')
    const completedTasks = activeTasks.filter(t => t.status === 'done')
    const dueTodayTasks = todoTasks.filter(t => t.due_date && isToday(parseISO(t.due_date)))
    const highPriorityTasks = todoTasks.filter(t => t.priority === 'high')

    // Event calculations
    const todayEvents = activeEvents.filter(e => {
      const start = parseISO(e.start_date)
      return isToday(start)
    })
    
    // Notes calculations
    const pinnedNotes = activeNotes.filter(n => n.pinned)
    const recentNotes = [...activeNotes].sort((a, b) => 
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    ).slice(0, 3)

    // Summary stats
    const stats = {
      tasks: {
        active: todoTasks.length,
        completed: completedTasks.length,
        dueToday: dueTodayTasks.length,
        highPriority: highPriorityTasks.length,
      },
      events: {
        today: todayEvents.length,
        upcoming: activeEvents.filter(e => isAfter(parseISO(e.start_date), new Date())).length
      },
      notes: {
        total: activeNotes.length,
        pinned: pinnedNotes.length,
      },
      projects: {
        active: projects.length,
      }
    }

    // Unified "Next Actions"
    // Combining high priority tasks and upcoming events
    const nextActions = [
      ...highPriorityTasks.map(t => ({ ...t, type: 'task' as const })),
      ...todayEvents.map(e => ({ ...e, type: 'event' as const }))
    ].sort((a, b) => {
      const aTime = 'start_date' in a ? new Date(a.start_date).getTime() : (a.due_date ? new Date(a.due_date).getTime() : Infinity)
      const bTime = 'start_date' in b ? new Date(b.start_date).getTime() : (b.due_date ? new Date(b.due_date).getTime() : Infinity)
      return aTime - bTime
    }).slice(0, 6)

    return {
      stats,
      nextActions,
      recentNotes,
      pinnedNotes,
      todayEvents,
      activeProjects: projects,
      isLoading: false, // In a real app we might have a global loading state
    }
  }, [tasks, notes, events, projects])
}
