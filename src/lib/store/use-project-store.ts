import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Project } from '@/types'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'

interface ProjectState {
  projects: Project[]
  setProjects: (projects: Project[]) => void
  addProject: (project: Omit<Project, 'id' | 'created_at' | 'task_count' | 'completed_task_count' | 'progress'>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>
}

// User state is managed in useUserStore

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      setProjects: (projects) => set({ projects }),
      addProject: async (pr) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        let userId = useUserStore.getState().user?.id
        
        // Robust fallback: fetch user directly if store is empty
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }

        if (!userId) return console.warn('No authenticated user')

        const hlc = `${Date.now()}:0:web`
        const { data, error } = await supabase
          .from('projects')
          .insert([{ 
            ...pr, 
            user_id: userId,
            hlc_timestamp: hlc,
            updated_at: new Date().toISOString()
          }])
          .select()
        if (error) {
          console.error('Error adding project:', error)
        } else if (data) {
          set(state => ({ projects: [data[0], ...state.projects] }))
        }
      },
      updateProject: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        const hlc = `${Date.now()}:0:web`
        const { error } = await supabase.from('projects').update({
          ...updates,
          hlc_timestamp: hlc,
          updated_at: new Date().toISOString()
        }).eq('id', id)
        if (error) console.error('Error updating project:', error)
      },
      deleteProject: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const deleted_at = new Date().toISOString()
        const hlc = `${Date.now()}:0:web`
        
        // Optimistic update
        set(state => ({
          projects: state.projects.filter(p => p.id !== id)
        }))

        const { error } = await supabase.from('projects').update({ 
          deleted_at,
          is_deleted: true,
          deleted_hlc: hlc,
          hlc_timestamp: hlc,
          updated_at: deleted_at
        }).eq('id', id)
        if (error) {
          console.error('Error deleting project:', error)
          // Re-fetch or revert if needed
        }
      },
      toggleFavorite: async (id, isFavorite) => {
        if (!supabase) return console.warn('Supabase not configured')
        const hlc = `${Date.now()}:0:web`
        const { error } = await supabase.from('projects').update({ 
          is_favorite: isFavorite,
          hlc_timestamp: hlc
        }).eq('id', id)
        if (error) console.error('Error toggling favorite:', error)
      },
    }),
    { name: 'synq-projects' }
  )
)
