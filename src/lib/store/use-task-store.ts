import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Task } from '@/types'
import { hlc } from '@/lib/hlc'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'

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
        
        // RLS automatically filters by user_id (auth.uid() = user_id)
        let query = supabase
          .from('tasks')
          .select('*')
        
        if (!includeDeleted) {
          query = query.eq('is_deleted', false)
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
        
        let userId = useUserStore.getState().user?.id
        
        // Robust fallback: fetch user directly if store is empty
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }

        if (!userId) {
          set({ error: 'No authenticated user' })
          return console.warn('No authenticated user')
        }

        // Format due_date to YYYY-MM-DD for Postgres date column if it's a full ISO string
        let formattedDate = t.due_date
        if (formattedDate && formattedDate.includes('T')) {
          formattedDate = formattedDate.split('T')[0]
        }

        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('tasks')
          .insert([{ 
            ...t, 
            due_date: formattedDate,
            user_id: userId,
            hlc_timestamp: timestamp,
            updated_at: now
          }])
          .select()
        
        if (error) {
          console.error('Error adding task:', error)
          set({ error: error.message })
        } else if (data) {
          set(state => ({ tasks: [data[0], ...state.tasks] }))
        }
      },

      updateTask: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        const previousTasks = get().tasks
        
        // Optimistic update
        set(state => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates, hlc_timestamp: timestamp, updated_at: now } : t)
        }))

        const { error } = await supabase.from('tasks').update({
          ...updates,
          hlc_timestamp: timestamp,
          updated_at: now
        }).eq('id', id)
        if (error) {
          console.error('Error updating task:', error)
          set({ tasks: previousTasks, error: error.message })
          get().fetchTasks()
        }
      },

      deleteTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const now = new Date().toISOString()
        const timestamp = hlc.increment()
        const previousTasks = get().tasks
        
        set(state => ({
          tasks: state.tasks.filter(t => t.id !== id)
        }))

        const { error } = await supabase.from('tasks').update({ 
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now
        }).eq('id', id)
        if (error) {
          console.error('Error moving task to trash:', error)
          set({ tasks: previousTasks, error: error.message })
          get().fetchTasks()
        }
      },

      restoreTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        
        const { error } = await supabase.from('tasks').update({ 
          deleted_at: null,
          is_deleted: false,
          deleted_hlc: null,
          hlc_timestamp: timestamp,
          updated_at: now
        }).eq('id', id)
        if (error) {
          console.error('Error restoring task:', error)
          set({ error: error.message })
        } else {
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
