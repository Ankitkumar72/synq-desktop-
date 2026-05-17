import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Folder } from '@/types'
import { hlc, HLC } from '@/lib/hlc'
import { supabase } from '@/lib/supabase.client'
import { useUserStore } from './use-user-store'
import { mergeFields, stampFields } from '@/lib/crdt/field-crdt'
import { enqueueOperation } from '@/lib/crdt/offline-queue'
import { triggerFlush, getOnlineStatus } from '@/lib/crdt/sync-manager'
import { TABLES, COLUMNS } from '@/lib/constants'

const SKIP_FIELDS = ['id', 'user_id', 'created_at', 'field_versions', 'hlc_timestamp', 'deleted_hlc']

interface FolderState {
  folders: Folder[]
  isLoading: boolean
  error: string | null
  setFolders: (folders: Folder[]) => void
  fetchFolders: (includeDeleted?: boolean) => Promise<void>
  addFolder: (folder: Omit<Folder, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  mergeFolderLocal: (remote: Folder) => void
  clearStore: () => void
}

export const useFolderStore = create<FolderState>()(
  persist(
    (set, get) => ({
      folders: [],
      isLoading: false,
      error: null,
      setFolders: (folders) => set({ folders }),

      fetchFolders: async (includeDeleted = false) => {
        if (!supabase || get().isLoading) return
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
          let query = supabase.from(TABLES.FOLDERS).select('*').eq(COLUMNS.USER_ID, userId)

          if (!includeDeleted) {
            query = query.eq(COLUMNS.IS_DELETED, false)
          }

          const { data, error } = await query.order('created_at', { ascending: false })
          if (error) {
            console.error('[FolderStore] Error fetching folders:', error)
            set({ error: error.message, isLoading: false })
            return
          }

          const currentFolders = get().folders
          const merged = mergeFolderList(currentFolders, data || [], true, includeDeleted)
          set({ folders: merged, isLoading: false })
        } catch (err) {
          console.error('[FolderStore] Unexpected error in fetchFolders:', err)
          set({ error: err instanceof Error ? err.message : String(err), isLoading: false })
        }
      },

      addFolder: async (folder) => {
        if (!supabase) return console.warn('Supabase not configured')

        let userId = useUserStore.getState().user?.id
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }

        if (!userId) return console.warn('No authenticated user')

        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        const folderId = crypto.randomUUID()

        const newFieldVersions: Record<string, string> = {}
        const defaultFields = ['name', 'color', 'parent_id', 'order', 'updated_at', 'created_at']
        for (const key of defaultFields) {
          newFieldVersions[key] = timestamp
        }

        const folderPayload: Folder = {
          ...folder,
          id: folderId,
          user_id: userId,
          hlc_timestamp: timestamp,
          field_versions: newFieldVersions,
          updated_at: now,
          created_at: now,
        }

        const optimisticFolder: Folder = {
          ...folderPayload,
          user_id: undefined,
        }

        set((state) => ({ folders: [optimisticFolder, ...state.folders] }))

        if (getOnlineStatus()) {
          const { data, error } = await supabase
            .from(TABLES.FOLDERS)
            .insert([folderPayload])
            .select()
          if (error) {
            console.error('[FolderStore] Error adding folder:', error)
            await enqueueOperation({
              entityType: 'folder',
              entityId: folderId,
              operationType: 'insert',
              payload: folderPayload,
              hlcTimestamp: timestamp,
            })
            triggerFlush()
          } else if (data?.[0]) {
            set((state) => ({
              folders: state.folders.map((f) => (f.id === folderId ? data[0] : f)),
            }))
          }
        } else {
          await enqueueOperation({
            entityType: 'folder',
            entityId: folderId,
            operationType: 'insert',
            payload: folderPayload,
            hlcTimestamp: timestamp,
          })
        }
      },

      updateFolder: async (id, updates) => {
        if (!supabase) return console.warn('Supabase not configured')
        const timestamp = hlc.increment()
        const now = new Date().toISOString()
        const currentFolder = get().folders.find((f) => f.id === id)

        const updatedKeys = Object.keys(updates).filter((k) => !SKIP_FIELDS.includes(k))
        const existingVersions = currentFolder?.field_versions || {}
        const newVersions = stampFields(existingVersions, updatedKeys, timestamp)

        const payload = {
          ...updates,
          hlc_timestamp: timestamp,
          field_versions: newVersions,
          updated_at: now,
        }

        set((state) => ({
          folders: state.folders.map((f) => (f.id === id ? { ...f, ...payload } : f)),
        }))

        if (getOnlineStatus()) {
          const { error } = await supabase.from(TABLES.FOLDERS).update(payload).eq('id', id)
          if (error) {
            console.error('Error updating folder:', error)
            await enqueueOperation({ entityType: 'folder', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'folder', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      deleteFolder: async (id) => {
        if (!supabase) return console.warn('Supabase not configured')
        const now = new Date().toISOString()
        const timestamp = hlc.increment()

        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
        }))

        const payload = {
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now,
        }

        if (getOnlineStatus()) {
          const { error } = await supabase.from(TABLES.FOLDERS).update(payload).eq('id', id)
          if (error) {
            console.error('Error deleting folder:', error)
            await enqueueOperation({ entityType: 'folder', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
            triggerFlush()
          }
        } else {
          await enqueueOperation({ entityType: 'folder', entityId: id, operationType: 'update', payload, hlcTimestamp: timestamp })
        }
      },

      mergeFolderLocal: (remote: Folder) => {
        if (remote.hlc_timestamp) {
          hlc.receive(remote.hlc_timestamp)
        }

        set((state) => {
          const localIdx = state.folders.findIndex((f) => f.id === remote.id)

          if (localIdx === -1) {
            if (remote.is_deleted) return state
            return { folders: [remote, ...state.folders] }
          }

          const local = state.folders[localIdx]

          if (remote.is_deleted) {
            return { folders: state.folders.filter((f) => f.id !== remote.id) }
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
          const newFolders = [...state.folders]
          newFolders[localIdx] = merged
          return { folders: newFolders }
        })
      },

      clearStore: () => set({ folders: [], isLoading: false, error: null }),
    }),
    { name: 'synq-folders' }
  )
)

function mergeFolderList(local: Folder[], remote: Folder[], isComprehensive = false, includesDeleted = false): Folder[] {
  const remoteMap = new Map(remote.map((f) => [f.id, f]))
  const merged = new Map<string, Folder>()

  for (const localFolder of local) {
    const remoteFolder = remoteMap.get(localFolder.id)

    if (remoteFolder) {
      const remoteHlc = remoteFolder.hlc_timestamp || ''
      const localHlc = localFolder.hlc_timestamp || ''

      if (HLC.compare(remoteHlc, localHlc) >= 0) {
        merged.set(localFolder.id, remoteFolder)
      } else {
        merged.set(localFolder.id, localFolder)
      }
    } else if (isComprehensive) {
      const isNewLocal = !localFolder.user_id
      if (isNewLocal) {
        merged.set(localFolder.id, localFolder)
      } else if (!includesDeleted && localFolder.is_deleted) {
        merged.set(localFolder.id, localFolder)
      }
    } else {
      merged.set(localFolder.id, localFolder)
    }
  }

  for (const remoteFolder of remote) {
    if (!merged.has(remoteFolder.id)) {
      merged.set(remoteFolder.id, remoteFolder)
    }
  }

  return Array.from(merged.values())
}
