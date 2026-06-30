import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Folder } from '../types'
import { hlc, HLC } from '../hlc'
import { supabase } from '../supabase/supabase'
import { useUserStore } from './use-user-store'
import { mergeFields, stampFields } from '../crdt/field-crdt'
import { enqueueOperation } from '../crdt/offline-queue'
import { triggerFlush, getOnlineStatus } from '../crdt/sync-manager'
import { TABLES, COLUMNS } from '../constants'
import { idbStorage } from './idb-storage'

const SKIP_FIELDS = ['id', 'user_id', 'created_at', 'field_versions', 'hlc_timestamp', 'deleted_hlc']

interface FolderState {
  folders: Folder[]
  isLoading: boolean
  error: string | null
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  setFolders: (folders: Folder[]) => void
  fetchFolders: (includeDeleted?: boolean, prefetchedData?: Folder[]) => Promise<void>
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
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setFolders: (folders) => set({ folders }),

      fetchFolders: async (includeDeleted = false, prefetchedData?: Folder[]) => {
        if (!supabase || get().isLoading) return
        if (get().folders.length === 0) {
          set({ isLoading: true, error: null })
        }

        const userId = useUserStore.getState().user?.id
        

        if (!userId) {
          set({ error: 'No authenticated user', isLoading: false })
          return
        }

        try {
          let data = prefetchedData;
          
          if (!data) {
            let query = supabase.from(TABLES.FOLDERS).select('*').eq(COLUMNS.USER_ID, userId)

            if (!includeDeleted) {
              query = query.eq(COLUMNS.IS_DELETED, false)
            }

            const res = await query.order('created_at', { ascending: false })
            if (res.error) {
              console.error('[FolderStore] Error fetching folders:', res.error)
              set({ error: res.error.message, isLoading: false })
              return
            }
            data = res.data || []
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

        const userId = useUserStore.getState().user?.id
        

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
              payload: folderPayload as unknown as Record<string, unknown>,
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
            payload: folderPayload as unknown as Record<string, unknown>,
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

        // 1. Find all descendant folder IDs recursively
        const descendantFolderIds = getDescendantFolderIds(get().folders, id)
        const allFolderIds = [id, ...descendantFolderIds]

        // 2. Dynamically import useNotesStore to prevent circular dependency
        const notesStore = (await import('./use-notes-store')).useNotesStore
        
        // Find active notes in these folders
        const activeNotes = notesStore.getState().notes.filter(
          (n) => n.folder_id && allFolderIds.includes(n.folder_id) && !n.is_deleted
        )

        // 3. Optimistically update local folders state
        set((state) => ({
          folders: state.folders.filter((f) => !allFolderIds.includes(f.id)),
        }))

        // 4. Soft-delete the folders in db or queue
        const folderPayload = {
          deleted_at: now,
          is_deleted: true,
          deleted_hlc: timestamp,
          hlc_timestamp: timestamp,
          updated_at: now,
        }

        if (getOnlineStatus()) {
          const { error } = await supabase
            .from(TABLES.FOLDERS)
            .update(folderPayload)
            .in('id', allFolderIds)
          if (error) {
            console.error('Error deleting folders:', error)
            for (const folderId of allFolderIds) {
              await enqueueOperation({
                entityType: 'folder',
                entityId: folderId,
                operationType: 'update',
                payload: folderPayload,
                hlcTimestamp: timestamp,
              })
            }
            triggerFlush()
          }
        } else {
          for (const folderId of allFolderIds) {
            await enqueueOperation({
              entityType: 'folder',
              entityId: folderId,
              operationType: 'update',
              payload: folderPayload,
              hlcTimestamp: timestamp,
            })
          }
        }

        // 5. Cascade soft-delete to all active notes in these folders
        for (const note of activeNotes) {
          await notesStore.getState().deleteNote(note.id)
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
    {
      name: 'synq-folders',
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true)
      },
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !['isLoading', 'error', '_hasHydrated'].includes(key))
        ) as FolderState,
      merge: (persistedState: any, currentState: FolderState) => {
        if (!persistedState) return currentState;
        return {
          ...currentState,
          ...persistedState,
          folders: mergeFolderList(currentState.folders || [], persistedState.folders || []),
          _hasHydrated: true,
        };
      },
    }
  )
)

function getDescendantFolderIds(folders: Folder[], parentId: string): string[] {
  const children = folders.filter((f) => f.parent_id === parentId)
  const childIds = children.map((c) => c.id)
  const descendantIds = [...childIds]
  for (const childId of childIds) {
    descendantIds.push(...getDescendantFolderIds(folders, childId))
  }
  return descendantIds
}

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
