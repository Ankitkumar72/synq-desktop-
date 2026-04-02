import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Task } from '@/types'
import { supabase } from '@/lib/supabase.client'

interface TaskState {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  addTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  restoreTask: (id: string) => Promise<void>
  permanentlyDeleteTask: (id: string) => Promise<void>
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      tasks: [],
      setTasks: (tasks) => set({ tasks }),
      addTask: async (t) => {
        if (!supabase) return console.warn('Supabase not configured')
        const { error } = await supabase.from('tasks').insert([t])
        if (error) console.error('Error adding task:', error)
      },
      updateTask: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        const { error } = await supabase.from('tasks').update(updates).eq('id', id)
        if (error) console.error('Error updating task:', error)
      },
      deleteTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const deleted_at = new Date().toISOString()
        
        set(state => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, deleted_at } : t)
        }))

        const { error } = await supabase.from('tasks').update({ deleted_at }).eq('id', id)
        if (error) {
          console.error('Error moving task to trash:', error)
          set(state => ({
            tasks: state.tasks.map(t => t.id === id ? { ...t, deleted_at: undefined } : t)
          }))
        }
      },
      restoreTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        set(state => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, deleted_at: undefined } : t)
        }))

        const { error } = await supabase.from('tasks').update({ deleted_at: null }).eq('id', id)
        if (error) {
          console.error('Error restoring task:', error)
          set(state => ({
            tasks: state.tasks.map(t => t.id === id ? { ...t, deleted_at: new Date().toISOString() } : t)
          }))
        }
      },
      permanentlyDeleteTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        set(state => ({
          tasks: state.tasks.filter(t => t.id !== id)
        }))

        const { error } = await supabase.from('tasks').delete().eq('id', id)
        if (error) console.error('Error permanently deleting task:', error)
      },
    }),
    { name: 'synq-tasks' }
  )
)
