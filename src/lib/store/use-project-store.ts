import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Project } from '@/types'
import { hlc, HLC } from '@/lib/hlc'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'
import { enqueueOperation } from '@/lib/crdt/offline-queue'
import { triggerFlush, getOnlineStatus } from '@/lib/crdt/sync-manager'

interface ProjectState {
  projects: Project[]
  setProjects: (projects: Project[]) => void
  addProject: (project: Omit<Project, 'id' | 'created_at' | 'task_count' | 'completed_task_count' | 'progress'>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>
  mergeProjectLocal: (remote: Project) => void
  clearStore: () => void
}

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

        const timestamp = hlc.increment()
        const now = new Date().toISOString()

        const newFieldVersions: Record<string, string> = {}
        const defaultFields = ['name', 'description', 'color', 'status', 'is_favorite', 'updated_at', 'created_at']
        
        defaultFields.forEach(key => {
          newFieldVersions[key] = timestamp
        })

        const projectPayload = { 
          ...pr, 
          user_id: userId,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          updated_at: now
        }

        // Optimistic insert
        const tempId = crypto.randomUUID()
        const optimisticProject: Project = {
          ...projectPayload,
          id: tempId,
          created_at: now,
          task_count: 0,
          completed_task_count: 0,
          progress: 0,
        }
        set(state => ({ projects: [optimisticProject, ...state.projects] }))

        if (getOnlineStatus()) {
          const { data, error } = await supabase
            .from('projects')
            .insert([projectPayload])
            .select()
          if (error) {
            console.error('[ProjectStore] Error adding project:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            })
            await enqueueOperation({
              entityType: 'project',
              entityId: tempId,
              operationType: 'insert',
              payload: projectPayload,
              hlcTimestamp: timestamp,
            })
            triggerFlush()
          } else if (data) {
            set(state => ({ 
              projects: state.projects.map(p => p.id === tempId ? data[0] : p)
            }))
          }
        } else {
          await enqueueOperation({
            entityType: 'project',
            entityId: tempId,
            operationType: 'insert',
            payload: projectPayload,
            hlcTimestamp: timestamp,
          })
        }
      },

      updateProject: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()

        const payload = {
          ...updates,
          hlc_timestamp: timestamp,
          updated_at: now,
        }

        // Optimistic update
        set(state => ({
          projects: state.projects.map(p => p.id === id ? { ...p, ...payload } : p)
        }))

        if (getOnlineStatus()) {
          const { error } = await supabase.from('projects').update(payload).eq('id', id)
          if (error) {
            console.error('Error updating project:', error)
            await enqueueOperation({ entityType: 'project', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'project', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      deleteProject: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const now = new Date().toISOString()
        const timestamp = hlc.increment()
        
        // Optimistic update
        set(state => ({
          projects: state.projects.filter(p => p.id !== id)
        }))

        const payload = { 
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from('projects').update(payload).eq('id', id)
          if (error) {
            console.error('Error deleting project:', error)
            await enqueueOperation({ entityType: 'project', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'project', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      toggleFavorite: async (id, isFavorite) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()

        // Optimistic update
        set(state => ({
          projects: state.projects.map(p => p.id === id ? { ...p, is_favorite: isFavorite } : p)
        }))

        const payload = { 
          is_favorite: isFavorite,
          hlc_timestamp: timestamp,
          updated_at: now,
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from('projects').update(payload).eq('id', id)
          if (error) {
            console.error('Error toggling favorite:', error)
            await enqueueOperation({ entityType: 'project', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'project', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      /**
       * CRDT merge: merge a remote project into local state.
       * Called by DatabaseProvider when a Realtime change arrives.
       */
      mergeProjectLocal: (remote: Project) => {
        // Advance our clock
        if (remote.hlc_timestamp) {
          hlc.receive(remote.hlc_timestamp)
        }

        set(state => {
          const localIdx = state.projects.findIndex(p => p.id === remote.id)

          if (localIdx === -1) {
            // New project from remote
            if (remote.is_deleted) return state
            return { projects: [remote, ...state.projects] }
          }

          const local = state.projects[localIdx]

          // Handle deletion
          if (remote.is_deleted) {
            return { projects: state.projects.filter(p => p.id !== remote.id) }
          }

          // HLC-based LWW merge at record level
          if (remote.hlc_timestamp && local.hlc_timestamp && HLC.compare(remote.hlc_timestamp, local.hlc_timestamp) > 0) {
            const newProjects = [...state.projects]
            newProjects[localIdx] = remote
            return { projects: newProjects }
          }

          // If remote has no HLC or local is newer, keep local
          return state
        })
      },

      clearStore: () => set({ projects: [] }),
    }),
    { name: 'synq-projects' }
  )
)
