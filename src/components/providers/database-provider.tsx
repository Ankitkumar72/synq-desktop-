"use client"

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase.client'
import { useTaskStore } from '@/lib/store/use-task-store'
import { useProjectStore } from '@/lib/store/use-project-store'
import { useNotesStore } from '@/lib/store/use-notes-store'

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const { setTasks } = useTaskStore()
  const { setProjects } = useProjectStore()
  const { setNotes } = useNotesStore()

  useEffect(() => {
    if (!supabase) {
      console.warn('Supabase not configured. Live updates disabled.')
      return
    }

    // Initial fetch
    const fetchData = async () => {
      const [{ data: tasks }, { data: projects }, { data: notes }] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
      ])

      if (tasks) setTasks(tasks)
      if (projects) setProjects(projects)
      if (notes) setNotes(notes)
    }

    fetchData()

    // Real-time subscriptions
    const taskChannel = supabase
      .channel('public:tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchData() // Simple approach: refetch on any change
      })
      .subscribe()

    const projectChannel = supabase
      .channel('public:projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchData()
      })
      .subscribe()

    const noteChannel = supabase
      .channel('public:notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(taskChannel)
      supabase.removeChannel(projectChannel)
      supabase.removeChannel(noteChannel)
    }
  }, [setTasks, setProjects, setNotes])

  return <>{children}</>
}
