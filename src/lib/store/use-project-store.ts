import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Project } from '@/types'
import { supabase } from '@/lib/supabase.client'

interface ProjectState {
  projects: Project[]
  setProjects: (projects: Project[]) => void
  addProject: (project: Omit<Project, 'id' | 'created_at' | 'task_count' | 'completed_task_count' | 'progress'>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      setProjects: (projects) => set({ projects }),
      addProject: async (pr) => {
        if (!supabase) return console.warn('Supabase not configured')
        const { error } = await supabase.from('projects').insert([pr])
        if (error) console.error('Error adding project:', error)
      },
      updateProject: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        const { error } = await supabase.from('projects').update(updates).eq('id', id)
        if (error) console.error('Error updating project:', error)
      },
      deleteProject: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const { error } = await supabase.from('projects').delete().eq('id', id)
        if (error) console.error('Error deleting project:', error)
      },
      toggleFavorite: async (id, isFavorite) => {
        if (!supabase) return console.warn('Supabase not configured')
        const { error } = await supabase.from('projects').update({ is_favorite: isFavorite }).eq('id', id)
        if (error) console.error('Error toggling favorite:', error)
      },
    }),
    { name: 'synq-projects' }
  )
)
