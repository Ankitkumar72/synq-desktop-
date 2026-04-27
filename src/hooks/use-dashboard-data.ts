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

    // Event calculations
    const todayEvents = activeEvents.filter(e => {
      const start = parseISO(e.start_date)
      return isToday(start)
    })
    
    // Notes calculations
    const pinnedNotes = activeNotes.filter(n => n.pinned)

    // Summary stats
    const stats = {
      tasks: {
        active: todoTasks.length,
        completed: completedTasks.length,
        dueToday: dueTodayTasks.length,
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

    return {
      stats,
      isLoading: false,
    }
  }, [tasks, notes, events, projects])
}
