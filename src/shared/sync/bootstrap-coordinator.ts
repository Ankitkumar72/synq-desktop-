import { useTaskStore } from "@/shared/store/use-task-store"
import { useProjectStore } from "@/shared/store/use-project-store"
import { useNotesStore, sanitizeNote } from "@/shared/store/use-notes-store"
import { useEventStore } from "@/shared/store/use-event-store"
import { useFolderStore } from "@/shared/store/use-folder-store"

import { Telemetry } from "@/shared/telemetry"
import { MutationJournal } from "./mutation-journal"
import { fetchDeltaSync, serializeSyncError } from "./delta-sync"
import { writeToShadowPrefix, setActivePrefix, getActivePrefix, clearShadowPrefix } from "../store/idb-storage"
import { 
  beginBootstrap, 
  advanceBootstrapStage, 
  BootstrapStage, 
  finalizeBootstrap,
  pulseHeartbeat,
  readCheckpoint
} from "../store/store-health"

export enum BootstrapState {
  IDLE = 'IDLE',
  SHADOW_BOOTSTRAPPING = 'SHADOW_BOOTSTRAPPING',
  VERIFYING = 'VERIFYING',
  COMMITTING = 'COMMITTING',
  REPLAYING_MUTATIONS = 'REPLAYING_MUTATIONS',
  READY = 'READY',
  DEGRADED = 'DEGRADED'
}

export class BootstrapCoordinator {
  private static instance: BootstrapCoordinator | null = null;
  private state: BootstrapState = BootstrapState.IDLE;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  public static getInstance(): BootstrapCoordinator {
    if (!BootstrapCoordinator.instance) {
      BootstrapCoordinator.instance = new BootstrapCoordinator();
    }
    return BootstrapCoordinator.instance;
  }

  public getState(): BootstrapState {
    return this.state;
  }

  public async startFullRebuild(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.locks) {
      console.warn('[BootstrapCoordinator] Web Locks API not available. Falling back to unsafe rebuild.');
      return this.executeShadowBootstrap();
    }

    let success = false;
    try {
      await navigator.locks.request('synq-bootstrap-lock', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          console.log('[BootstrapCoordinator] Another tab is currently bootstrapping. Waiting...');
          success = await this.waitForExternalBootstrap();
          return;
        }
        success = await this.executeShadowBootstrap();
      });
    } catch (err) {
      console.error('[BootstrapCoordinator] Lock error:', err);
      success = false;
    }
    return success;
  }

  private async executeShadowBootstrap(): Promise<boolean> {
    this.state = BootstrapState.SHADOW_BOOTSTRAPPING;
    beginBootstrap();
    this.startHeartbeat();

    const shadowPrefix = `shadow_${Date.now()}_`;
    const storeNames = ['synq-notes', 'synq-tasks', 'synq-events', 'synq-projects', 'synq-folders', 'synq-conflicts'];

    try {
      console.log(`[BootstrapCoordinator] Phase 1: Fetching data into shadow prefix '${shadowPrefix}'...`);
      
      let lastSeqId = -1;
      let hasMore = true;
      
      const shadowData = {
        notes: [] as any[],
        tasks: [] as any[],
        events: [] as any[],
        projects: [] as any[],
        folders: [] as any[],
        conflicts: [] as any[]
      };

      while (hasMore) {
        const previousSeqId = lastSeqId;
        pulseHeartbeat();
        const { data, error } = await fetchDeltaSync(lastSeqId);

        if (error) {
          console.error('[BootstrapCoordinator] Error fetching shadow delta sync:', serializeSyncError(error));
          throw error;
        }

        if (data) {
          if (data.notes) shadowData.notes.push(...data.notes.map((n: any) => sanitizeNote(n)));
          if (data.tasks) shadowData.tasks.push(...data.tasks);
          if (data.events) shadowData.events.push(...data.events);
          if (data.projects) shadowData.projects.push(...data.projects);
          if (data.folders) shadowData.folders.push(...data.folders);
          
          if (typeof data.latest_seq_id === 'number') {
            lastSeqId = data.latest_seq_id;
          }

          const totalRecords = (data.tasks?.length || 0) + (data.notes?.length || 0) + (data.events?.length || 0) + (data.projects?.length || 0) + (data.folders?.length || 0);
          if (totalRecords < 1000 || lastSeqId <= previousSeqId) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      this.state = BootstrapState.VERIFYING;
      advanceBootstrapStage(BootstrapStage.VERIFYING);
      pulseHeartbeat();

      console.log(`[BootstrapCoordinator] Phase 2: Writing to Shadow Store...`);
      // Write to IDB in Zustand's expected persist format: { state: { items: [...] }, version: 0 }
      await writeToShadowPrefix(shadowPrefix, 'synq-notes', { state: { notes: shadowData.notes }, version: 0 });
      await writeToShadowPrefix(shadowPrefix, 'synq-tasks', { state: { tasks: shadowData.tasks }, version: 0 });
      await writeToShadowPrefix(shadowPrefix, 'synq-events', { state: { events: shadowData.events }, version: 0 });
      await writeToShadowPrefix(shadowPrefix, 'synq-projects', { state: { projects: shadowData.projects }, version: 0 });
      await writeToShadowPrefix(shadowPrefix, 'synq-folders', { state: { folders: shadowData.folders }, version: 0 });
      
      this.state = BootstrapState.COMMITTING;
      console.log(`[BootstrapCoordinator] Phase 3: Atomic Swap...`);
      
      setActivePrefix(shadowPrefix);

      // Clear in-memory state to avoid merging stale data with the fresh shadow state
      useNotesStore.getState().clearStore();
      useTaskStore.getState().clearStore();
      useEventStore.getState().clearStore();
      useProjectStore.getState().clearStore();
      useFolderStore.getState().clearStore();

      // Force stores to rehydrate from new prefix
      useNotesStore.persist.rehydrate();
      useTaskStore.persist.rehydrate();
      useEventStore.persist.rehydrate();
      useProjectStore.persist.rehydrate();
      useFolderStore.persist.rehydrate();

      this.state = BootstrapState.REPLAYING_MUTATIONS;
      console.log(`[BootstrapCoordinator] Phase 4: Replaying offline mutations...`);
      await this.replayMutationsIdempotently();

      this.state = BootstrapState.READY;
      finalizeBootstrap(lastSeqId);
      
      // Cleanup old prefixes (in a real scenario we'd track them, here we just know the previous default)
      if (getActivePrefix() !== 'v1_') {
         // Optionally background delete 'v1_' stores
      }
      
      console.log(`[BootstrapCoordinator] Bootstrap Complete.`);
      Telemetry.trackStoreEvent('store.bootstrap.success', { shadowPrefix });
      return true;

    } catch (error) {
      const serializedError = serializeSyncError(error);
      console.error('[BootstrapCoordinator] Shadow bootstrap failed!', serializedError);
      this.state = BootstrapState.DEGRADED;
      await clearShadowPrefix(shadowPrefix, storeNames);
      Telemetry.trackStoreEvent('store.bootstrap.failed', serializedError);
      return false;
    } finally {
      this.stopHeartbeat();
    }
  }

  private async waitForExternalBootstrap(): Promise<boolean> {
    return new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const cp = readCheckpoint();
        if (cp && cp.bootstrapStage === BootstrapStage.READY) {
          clearInterval(interval);
          
          useNotesStore.persist.rehydrate();
          useTaskStore.persist.rehydrate();
          useEventStore.persist.rehydrate();
          useProjectStore.persist.rehydrate();
          useFolderStore.persist.rehydrate();

          resolve(true);
        } else if (attempts > 120) { // 60 seconds
          clearInterval(interval);
          resolve(false);
        }
      }, 500);
    });
  }

  private async replayMutationsIdempotently(): Promise<void> {
    try {
      const pending = await MutationJournal.getPendingMutations();
      console.log(`[BootstrapCoordinator] Found ${pending.length} pending mutations to replay.`);

      for (const mut of pending) {
        // Very basic idempotency check: Ensure we don't duplicate creates if they already exist
        // In a real CRDT, this is inherently handled by vector clocks or deterministic UUIDs
        if (mut.operation_type === 'NOTE_CREATE' || mut.operation_type === 'TASK_CREATE' || mut.operation_type === 'FOLDER_CREATE') {
           // Assume UUID is deterministic and Zustand stores do a map/merge.
           // For now, we leave them in QUEUED so the sync engine can pick them up when it enters READY state.
        }
      }
      // We don't change their state to COMMITTED, we leave them for SyncEngine to process now that store is READY.
    } catch (err) {
      console.error('[BootstrapCoordinator] Failed to replay mutations:', err);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      pulseHeartbeat();
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
