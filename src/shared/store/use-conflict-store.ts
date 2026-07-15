import { create } from 'zustand'
import { supabase } from '../supabase/supabase'
import { useUserStore } from './use-user-store'
import { enqueueOperation } from '../crdt/offline-queue'
import { triggerFlush, getOnlineStatus } from '../crdt/sync-manager'
import { useTaskStore } from './use-task-store'
import { useEventStore } from './use-event-store'
import { useProjectStore } from './use-project-store'
import { useNotesStore } from './use-notes-store'
import { useFolderStore } from './use-folder-store'

export interface ConflictLogEntry {
  id: string;
  entity_type: 'task' | 'event' | 'project' | 'note' | 'folder';
  entity_id: string;
  user_id: string;
  field_name: string | null;
  rejected_value: any;
  incoming_hlc: string;
  winning_hlc: string;
  reason: string;
  created_at: string;
}

interface ConflictState {
  conflicts: ConflictLogEntry[];
  isLoading: boolean;
  error: string | null;
  fetchConflicts: () => Promise<void>;
  dismissConflict: (conflictId: string) => Promise<void>;
  restoreConflict: (conflict: ConflictLogEntry) => Promise<void>;
  handleRealtimeConflict: (payload: any) => void;
  clearStore: () => void;
}

export const useConflictStore = create<ConflictState>()((set, get) => ({
  conflicts: [],
  isLoading: false,
  error: null,

  fetchConflicts: async () => {
    if (!supabase || get().isLoading) return;
    const userId = useUserStore.getState().user?.id;
    if (!userId) return;

    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('crdt_conflict_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ conflicts: data || [], isLoading: false });
    } catch (err: any) {
      console.error('[ConflictStore] Error fetching conflicts:', err?.message || err);
      set({ error: err?.message || String(err), isLoading: false });
    }
  },

  dismissConflict: async (conflictId: string) => {
    if (!supabase) return;

    // Optimistically remove from state
    set((state) => ({
      conflicts: state.conflicts.filter((c) => c.id !== conflictId),
    }));

    if (getOnlineStatus()) {
      const { error } = await supabase
        .from('crdt_conflict_log')
        .delete()
        .eq('id', conflictId);

      if (error) {
        console.error('[ConflictStore] Error dismissing conflict:', error);
        // We could enqueue a hard_delete for this table, but missing a dismissal offline
        // is low severity. Still, for robustness we enqueue it.
        await enqueueOperation({
          entityType: 'crdt_conflict_log',
          entityId: conflictId,
          operationType: 'hard_delete',
          payload: {},
          hlcTimestamp: '' // hlc isn't strict for conflict log rows
        });
        triggerFlush();
      }
    } else {
      await enqueueOperation({
        entityType: 'crdt_conflict_log',
        entityId: conflictId,
        operationType: 'hard_delete',
        payload: {},
        hlcTimestamp: ''
      });
    }
  },

  restoreConflict: async (conflict: ConflictLogEntry) => {
    if (!conflict.field_name) {
      console.warn('[ConflictStore] Cannot restore tombstone conflicts automatically yet.');
      return;
    }

    const payload = { [conflict.field_name]: conflict.rejected_value };
    
    // Applying this update locally automatically generates a new HLC timestamp
    // and sends the update to the offline queue/Supabase, successfully overwriting the current state.
    switch (conflict.entity_type) {
      case 'task':
        await useTaskStore.getState().updateTask(conflict.entity_id, payload);
        break;
      case 'event':
        await useEventStore.getState().updateEvent(conflict.entity_id, payload);
        break;
      case 'project':
        await useProjectStore.getState().updateProject(conflict.entity_id, payload);
        break;
      case 'note':
        await useNotesStore.getState().updateNote(conflict.entity_id, payload);
        break;
      case 'folder':
        await useFolderStore.getState().updateFolder(conflict.entity_id, payload);
        break;
    }

    // Dismiss after restoring
    await get().dismissConflict(conflict.id);
  },

  handleRealtimeConflict: (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    set((state) => {
      let nextConflicts = [...state.conflicts];
      if (eventType === 'INSERT') {
        // Unshift to put newest at the top
        nextConflicts = [newRecord as ConflictLogEntry, ...nextConflicts];
      } else if (eventType === 'DELETE') {
        nextConflicts = nextConflicts.filter(c => c.id !== oldRecord.id);
      }
      return { conflicts: nextConflicts };
    });
  },

  clearStore: () => set({ conflicts: [], isLoading: false, error: null }),
}));
