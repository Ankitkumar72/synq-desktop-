import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Task } from '@/types'
import { supabase } from '@/lib/supabase.client'

interface TaskState {
  tasks: Task[]
  isLoading: boolean
  error: string | null
  setTasks: (tasks: Task[]) => void
  fetchTasks: (includeDeleted?: boolean) => Promise<void>
  addTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  restoreTask: (id: string) => Promise<void>
  permanentlyDeleteTask: (id: string) => Promise<void>
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      isLoading: false,
      error: null,
      setTasks: (tasks) => set({ tasks }),
      
      fetchTasks: async (includeDeleted = false) => {
        if (!supabase) return
        set({ isLoading: true, error: null })
        
        let query = supabase
          .from('tasks')
          .select('*')
        
        if (!includeDeleted) {
          query = query.is('deleted_at', null)
        }
        
        const { data, error } = await query
          .order('created_at', { ascending: false })
        
        if (error) {
          set({ error: error.message, isLoading: false })
          console.error('Error fetching tasks:', error)
        } else {
          set({ tasks: data || [], isLoading: false })
        }
      },

      addTask: async (t) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        // Optimistic UI could be added here if needed, but let's wait for DB for tasks
        const { data, error } = await supabase.from('tasks').insert([t]).select()
        
        if (error) {
          console.error('Error adding task:', error)
          set({ error: error.message })
        } else if (data) {
          set(state => ({ tasks: [data[0], ...state.tasks] }))
        }
      },

      updateTask: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        const previousTasks = get().tasks
        set(state => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
        }))

        const { error } = await supabase.from('tasks').update(updates).eq('id', id)
        if (error) {
          console.error('Error updating task:', error)
          set({ tasks: previousTasks, error: error.message })
        }
      },

      deleteTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const deleted_at = new Date().toISOString()
        const previousTasks = get().tasks
        
        set(state => ({
          tasks: state.tasks.filter(t => t.id !== id)
        }))

        const { error } = await supabase.from('tasks').update({ deleted_at }).eq('id', id)
        if (error) {
          console.error('Error moving task to trash:', error)
          set({ tasks: previousTasks, error: error.message })
        }
      },

      restoreTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        const { error } = await supabase.from('tasks').update({ deleted_at: null }).eq('id', id)
        if (error) {
          console.error('Error restoring task:', error)
          set({ error: error.message })
        } else {
          // Re-fetch to get the restored task back in the list
          get().fetchTasks(false)
        }
      },

      permanentlyDeleteTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        const previousTasks = get().tasks
        set(state => ({
          tasks: state.tasks.filter(t => t.id !== id)
        }))

        const { error } = await supabase.from('tasks').delete().eq('id', id)
        if (error) {
          console.error('Error permanently deleting task:', error)
          set({ tasks: previousTasks, error: error.message })
        }
      },
    }),
    { name: 'synq-tasks' }
  )
)
