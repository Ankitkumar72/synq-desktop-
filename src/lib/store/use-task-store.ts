import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Task } from '@/types'
import { hlc, HLC } from '@/lib/hlc'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'
import { mergeFields, stampFields } from '@/lib/crdt/field-crdt'
import { enqueueOperation } from '@/lib/crdt/offline-queue'
import { triggerFlush, getOnlineStatus } from '@/lib/crdt/sync-manager'

const SKIP_FIELDS = ['id', 'user_id', 'created_at', 'field_versions', 'hlc_timestamp', 'deleted_hlc']

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
  deleteFutureInstances: (task: Task) => Promise<void>
  deleteAllInstances: (task: Task) => Promise<void>
  reorderTasks: (orderedIds: string[]) => void
  mergeTaskLocal: (remote: Task) => void
  clearStore: () => void
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
        
        let userId = useUserStore.getState().user?.id
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }

        if (!userId) {
          set({ error: 'No authenticated user', isLoading: false })
          return
        }

        // RLS automatically filters by user_id (auth.uid() = user_id)
        let query = supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
        
        if (!includeDeleted) {
          query = query.eq('is_deleted', false)
        }
        
        const { data, error } = await query
          .order('created_at', { ascending: false })
        
        if (error) {
          set({ error: error.message, isLoading: false })
          console.error('Error fetching tasks:', error)
        } else {
          // Merge each fetched task using CRDT merge to preserve local state
          const currentTasks = get().tasks
          const merged = mergeTaskList(currentTasks, data || [])
          set({ tasks: merged, isLoading: false })
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
        const taskPayload = { 
          ...t, 
          due_date: formattedDate,
          user_id: userId,
          hlc_timestamp: timestamp,
          updated_at: now
        }

        // Optimistic insert with a temporary ID
        const tempId = crypto.randomUUID()
        const optimisticTask: Task = {
          ...taskPayload,
          id: tempId,
          created_at: now,
        }
        set(state => ({ tasks: [optimisticTask, ...state.tasks] }))

        if (getOnlineStatus()) {
          const { data, error } = await supabase
            .from('tasks')
            .insert([taskPayload])
            .select()
          
          if (error) {
            console.error('Error adding task:', error)
            // Enqueue for retry
            await enqueueOperation({
              entityType: 'task',
              entityId: tempId,
              operationType: 'insert',
              payload: taskPayload,
              hlcTimestamp: timestamp,
            })
            triggerFlush()
          } else if (data) {
            // Replace temp task with real one
            set(state => ({ 
              tasks: state.tasks.map(task => 
                task.id === tempId ? data[0] : task
              )
            }))
          }
        } else {
          // Offline: queue the insert
          await enqueueOperation({
            entityType: 'task',
            entityId: tempId,
            operationType: 'insert',
            payload: taskPayload,
            hlcTimestamp: timestamp,
          })
        }
      },

      updateTask: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        const currentTask = get().tasks.find(t => t.id === id)
        
        // Build field versions for the updated fields
        const updatedKeys = Object.keys(updates).filter(k => !SKIP_FIELDS.includes(k))
        const existingVersions = currentTask?.field_versions || {}
        const newVersions = stampFields(existingVersions, updatedKeys, timestamp)
        
        const payload = {
          ...updates,
          hlc_timestamp: timestamp,
          field_versions: newVersions,
          updated_at: now,
        }

        // Optimistic update
        set(state => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, ...payload } : t)
        }))

        if (getOnlineStatus()) {
          const { error } = await supabase.from('tasks').update(payload).eq('id', id)
          if (error) {
            console.error('Error updating task:', error)
            // Queue for retry instead of rolling back
            await enqueueOperation({
              entityType: 'task',
              entityId: id,
              operationType: 'update',
              payload,
              hlcTimestamp: timestamp,
            })
            triggerFlush()
          }
        } else {
          await enqueueOperation({
            entityType: 'task',
            entityId: id,
            operationType: 'update',
            payload,
            hlcTimestamp: timestamp,
          })
        }
      },

      deleteTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const now = new Date().toISOString()
        const timestamp = hlc.increment()
        
        set(state => ({
          tasks: state.tasks.filter(t => t.id !== id)
        }))

        const payload = { 
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from('tasks').update(payload).eq('id', id)
          if (error) {
            console.error('Error moving task to trash:', error)
            await enqueueOperation({ entityType: 'task', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'task', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      restoreTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        
        const payload = { 
          deleted_at: null,
          is_deleted: false,
          deleted_hlc: null,
          hlc_timestamp: timestamp,
          updated_at: now
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from('tasks').update(payload).eq('id', id)
          if (error) {
            console.error('Error restoring task:', error)
            set({ error: error.message })
          } else {
            get().fetchTasks(false)
          }
        } else {
          await enqueueOperation({ entityType: 'task', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      permanentlyDeleteTask: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        
        set(state => ({
          tasks: state.tasks.filter(t => t.id !== id)
        }))

        if (getOnlineStatus()) {
          const { error } = await supabase.from('tasks').delete().eq('id', id)
          if (error) {
            console.error('Error permanently deleting task:', error)
            await enqueueOperation({ entityType: 'task', entityId: id, operationType: 'hard_delete', payload: {}, hlcTimestamp: hlc.increment() })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'task', entityId: id, operationType: 'hard_delete', payload: {}, hlcTimestamp: hlc.increment() })
        }
      },

      deleteFutureInstances: async (task) => {
        if (!supabase) return
        const now = new Date().toISOString()
        const timestamp = hlc.increment()
        const parentId = task.parent_recurring_id || task.id
        const startTime = task.due_date ? new Date(task.due_date).getTime() : 0

        set(state => ({
          tasks: state.tasks.filter(t => !( ( t.parent_recurring_id === parentId || t.id === parentId ) && (t.due_date ? new Date(t.due_date).getTime() : 0) >= startTime ))
        }))

        await supabase.from('tasks').update({
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now
        }).eq('parent_recurring_id', parentId).gte('due_date', task.due_date || '')
      },

      deleteAllInstances: async (task) => {
        if (!supabase) return
        const now = new Date().toISOString()
        const timestamp = hlc.increment()
        const parentId = task.parent_recurring_id || task.id

        set(state => ({
          tasks: state.tasks.filter(t => t.parent_recurring_id !== parentId && t.id !== parentId)
        }))

        await supabase.from('tasks').update({
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now
        }).or(`parent_recurring_id.eq.${parentId},id.eq.${parentId}`)
      },

      reorderTasks: (orderedIds) => {
        const timestamp = hlc.increment()
        const now = new Date().toISOString()

        set((state) => {
          const tasksMap = new Map(state.tasks.map(t => [t.id, t]))
          const reordered = orderedIds.map(id => tasksMap.get(id)).filter(Boolean) as Task[]
          const rest = state.tasks.filter(t => !orderedIds.includes(t.id))
          
          const finalTasks = [...reordered, ...rest].map((t, i) => ({ ...t, order: i }))
          
          // Persist order to Supabase via queue
          for (const task of finalTasks) {
            if (orderedIds.includes(task.id)) {
              enqueueOperation({
                entityType: 'task',
                entityId: task.id,
                operationType: 'update',
                payload: { order: task.order, hlc_timestamp: timestamp, updated_at: now },
                hlcTimestamp: timestamp,
              })
            }
          }
          triggerFlush()

          return { tasks: finalTasks }
        })
      },

      /**
       * CRDT merge: merge a remote task into local state using per-field LWW.
       * Called by the DatabaseProvider when a Realtime change arrives.
       */
      mergeTaskLocal: (remote: Task) => {
        // Advance our clock
        if (remote.hlc_timestamp) {
          hlc.receive(remote.hlc_timestamp)
        }

        set(state => {
          const localIdx = state.tasks.findIndex(t => t.id === remote.id)

          if (localIdx === -1) {
            // New task from remote — just add it
            if (remote.is_deleted) return state
            return { tasks: [remote, ...state.tasks] }
          }

          const local = state.tasks[localIdx]
          const remoteClientId = remote.hlc_timestamp ? HLC.extractNodeId(remote.hlc_timestamp) : 'unknown'
          const localClientId = hlc.getNodeId()

          // Handle deletion
          if (remote.is_deleted) {
            return { tasks: state.tasks.filter(t => t.id !== remote.id) }
          }

          // Per-field CRDT merge
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

          const newTasks = [...state.tasks]
          newTasks[localIdx] = merged
          return { tasks: newTasks }
        })
      },

      clearStore: () => set({ tasks: [], isLoading: false, error: null }),
    }),
    { name: 'synq-tasks' }
  )
)

/**
 * Merge a list of fetched tasks with the current local list.
 * Used during fetchTasks to avoid clobbering local optimistic state.
 */
function mergeTaskList(local: Task[], remote: Task[]): Task[] {
  const remoteMap = new Map(remote.map(t => [t.id, t]))
  const merged = new Map<string, Task>()

  // Start with local tasks
  for (const t of local) {
    merged.set(t.id, t)
  }

  // Merge remote tasks
  for (const [id, remoteTask] of remoteMap) {
    const localTask = merged.get(id)
    if (!localTask) {
      merged.set(id, remoteTask)
      continue
    }

    // Use HLC comparison for basic merge on fetch
    const remoteHlc = remoteTask.hlc_timestamp || ''
    const localHlc = localTask.hlc_timestamp || ''
    if (HLC.compare(remoteHlc, localHlc) >= 0) {
      merged.set(id, remoteTask)
    }
  }

  return Array.from(merged.values())
}
