import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Project } from '@/types'
import { hlc, HLC } from '@/lib/hlc'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'
import { mergeFields, stampFields } from '@/lib/crdt/field-crdt'
import { enqueueOperation } from '@/lib/crdt/offline-queue'
import { triggerFlush, getOnlineStatus } from '@/lib/crdt/sync-manager'

const SKIP_FIELDS = ['id', 'user_id', 'created_at', 'field_versions', 'hlc_timestamp', 'deleted_hlc']

interface ProjectState {
  projects: Project[]
  isLoading: boolean
  error: string | null
  setProjects: (projects: Project[]) => void
  fetchProjects: (includeDeleted?: boolean) => Promise<void>
  addProject: (project: Omit<Project, 'id' | 'created_at' | 'task_count' | 'completed_task_count' | 'progress'>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>
  mergeProjectLocal: (remote: Project) => void
  clearStore: () => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      isLoading: false,
      error: null,
      setProjects: (projects) => set({ projects }),

      fetchProjects: async (includeDeleted = false) => {
        if (!supabase) return
        set({ isLoading: true, error: null })

        let userId = useUserStore.getState().user?.id
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }

        if (!userId) {
          set({ error: 'No authenticated user', isLoading: false })
          return
        }

        try {
          let query = supabase.from('projects').select('*').eq('user_id', userId)

          if (!includeDeleted) {
            query = query.eq('is_deleted', false)
          }

          const { data, error, status, statusText } = await query.order('created_at', { ascending: false })
          if (error) {
            console.error('[ProjectStore] Error fetching projects:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              status,
              statusText,
            })
            set({ error: error.message, isLoading: false })
            return
          }

          const currentProjects = get().projects
          const merged = mergeProjectList(currentProjects, data || [], true, includeDeleted)
          set({ projects: merged, isLoading: false })
        } catch (err) {
          console.error('[ProjectStore] Unexpected error in fetchProjects:', err)
          set({ error: err instanceof Error ? err.message : String(err), isLoading: false })
        }
      },

      addProject: async (pr) => {
        if (!supabase) return console.warn('Supabase not configured')

        let userId = useUserStore.getState().user?.id

        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }

        if (!userId) return console.warn('No authenticated user')

        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        const projectId = crypto.randomUUID()

        const newFieldVersions: Record<string, string> = {}
        const defaultFields = ['name', 'description', 'color', 'status', 'is_favorite', 'updated_at', 'created_at']
        for (const key of defaultFields) {
          newFieldVersions[key] = timestamp
        }

        const projectPayload: Project = {
          ...pr,
          id: projectId,
          user_id: userId,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          updated_at: now,
          created_at: now,
          is_favorite: pr.is_favorite ?? false,
          task_count: 0,
          completed_task_count: 0,
          progress: 0,
        }

        const optimisticProject: Project = {
          ...projectPayload,
          user_id: undefined,
        }

        set((state) => ({ projects: [optimisticProject, ...state.projects] }))

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
              code: error.code,
            })
            await enqueueOperation({
              entityType: 'project',
              entityId: projectId,
              operationType: 'insert',
              payload: projectPayload,
              hlcTimestamp: timestamp,
            })
            triggerFlush()
          } else if (data?.[0]) {
            set((state) => ({
              projects: state.projects.map((p) => (p.id === projectId ? data[0] : p)),
            }))
          }
        } else {
          await enqueueOperation({
            entityType: 'project',
            entityId: projectId,
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
        const currentProject = get().projects.find((p) => p.id === id)

        const updatedKeys = Object.keys(updates).filter((k) => !SKIP_FIELDS.includes(k))
        const existingVersions = currentProject?.field_versions || {}
        const newVersions = stampFields(existingVersions, updatedKeys, timestamp)

        const payload = {
          ...updates,
          hlc_timestamp: timestamp,
          field_versions: newVersions,
          updated_at: now,
        }

        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...payload } : p)),
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

        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }))

        const payload = {
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now,
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
        const currentProject = get().projects.find((p) => p.id === id)
        const existingVersions = currentProject?.field_versions || {}
        const newVersions = stampFields(existingVersions, ['is_favorite', 'updated_at'], timestamp)

        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, is_favorite: isFavorite, field_versions: newVersions, hlc_timestamp: timestamp, updated_at: now } : p)),
        }))

        const payload = {
          is_favorite: isFavorite,
          hlc_timestamp: timestamp,
          field_versions: newVersions,
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

      mergeProjectLocal: (remote: Project) => {
        if (remote.hlc_timestamp) {
          hlc.receive(remote.hlc_timestamp)
        }

        set((state) => {
          const localIdx = state.projects.findIndex((p) => p.id === remote.id)

          if (localIdx === -1) {
            if (remote.is_deleted) return state
            return { projects: [remote, ...state.projects] }
          }

          const local = state.projects[localIdx]

          if (remote.is_deleted) {
            return { projects: state.projects.filter((p) => p.id !== remote.id) }
          }

          const remoteClientId = remote.hlc_timestamp ? HLC.extractNodeId(remote.hlc_timestamp) : 'unknown'
          const localClientId = hlc.getNodeId()

          const { merged, mergedVersions } = mergeFields(
            local,
            remote,
            local.field_versions || {},
            remote.field_versions || {},
            localClientId,
            remoteClientId,
            SKIP_FIELDS
          )

          merged.field_versions = mergedVersions
          const newProjects = [...state.projects]
          newProjects[localIdx] = merged
          return { projects: newProjects }
        })
      },

      clearStore: () => set({ projects: [], isLoading: false, error: null }),
    }),
    { name: 'synq-projects' }
  )
)

function mergeProjectList(local: Project[], remote: Project[], isComprehensive = false, includesDeleted = false): Project[] {
  const remoteMap = new Map(remote.map((p) => [p.id, p]))
  const merged = new Map<string, Project>()

  for (const localProject of local) {
    const remoteProject = remoteMap.get(localProject.id)

    if (remoteProject) {
      const remoteHlc = remoteProject.hlc_timestamp || ''
      const localHlc = localProject.hlc_timestamp || ''

      if (HLC.compare(remoteHlc, localHlc) >= 0) {
        merged.set(localProject.id, remoteProject)
      } else {
        merged.set(localProject.id, localProject)
      }
    } else if (isComprehensive) {
      const isNewLocal = !localProject.user_id
      if (isNewLocal) {
        merged.set(localProject.id, localProject)
      } else if (!includesDeleted && localProject.is_deleted) {
        merged.set(localProject.id, localProject)
      }
    } else {
      merged.set(localProject.id, localProject)
    }
  }

  for (const remoteProject of remote) {
    if (!merged.has(remoteProject.id)) {
      merged.set(remoteProject.id, remoteProject)
    }
  }

  return Array.from(merged.values())
}
