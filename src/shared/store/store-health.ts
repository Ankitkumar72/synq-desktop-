/**
 * Validated Startup Pipeline for Synq Desktop
 * 
 * Architecture:
 *   Application → StoreValidator → StoreHealthReport → RecoveryManager → Sync Engine
 * 
 * The StoreValidator is a pure function: Input → Validation → Output (no side effects).
 * The RecoveryManager consumes the report and executes the appropriate recovery strategy.
 * All sync metadata (cursor, generation, schema version) is persisted atomically
 * in a single Checkpoint object — they can never exist independently.
 * 
 * Bootstrap is staged: INITIALIZING → BOOTSTRAPPING → VERIFYING → READY
 * A crash at any stage before READY means the store is not trusted on next startup.
 */

import { useNotesStore } from './use-notes-store';
import { useTaskStore } from './use-task-store';
import { useEventStore } from './use-event-store';
import { useProjectStore } from './use-project-store';
import { useFolderStore } from './use-folder-store';
import { idbStorage } from './idb-storage';
import { Telemetry } from '../telemetry';
import { MutationJournal, Mutation } from '../sync/mutation-journal';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Checkpoint {
  generation: string;
  cursor: number;
  schemaVersion: number;
  entityCounts: EntityCounts;
  createdAt: string;
  bootstrapStage: BootstrapStage;
}

export interface EntityCounts {
  notes: number;
  tasks: number;
  events: number;
  projects: number;
  folders: number;
}

export enum BootstrapStage {
  INITIALIZING = 'INITIALIZING',
  BOOTSTRAPPING = 'BOOTSTRAPPING',
  VERIFYING = 'VERIFYING',
  READY = 'READY',
}

export enum StoreHealthState {
  HEALTHY = 'HEALTHY',
  REBUILD_REQUIRED = 'REBUILD_REQUIRED',
  MIGRATION_REQUIRED = 'MIGRATION_REQUIRED',
  RECOVERABLE = 'RECOVERABLE',
  FATAL = 'FATAL',
}

export enum RecoveryType {
  STORE_CORRUPTED = 'STORE_CORRUPTED',
  CACHE_MISSING = 'CACHE_MISSING',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  BOOTSTRAP_INTERRUPTED = 'BOOTSTRAP_INTERRUPTED',
}

export interface StoreHealthReport {
  state: StoreHealthState;
  recoveryType?: RecoveryType;
  checkpoint: Checkpoint | null;
  currentCounts: EntityCounts;
  details: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHECKPOINT_KEY = 'synq_checkpoint';
const CURRENT_SCHEMA_VERSION = 1;

// ─── Checkpoint Persistence (Atomic) ─────────────────────────────────────────
// The cursor, generation, and manifest are NEVER stored separately.
// They are always written and read as a single atomic JSON blob.

export function readCheckpoint(): Checkpoint | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CHECKPOINT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Validate shape
    if (
      typeof parsed.generation !== 'string' ||
      typeof parsed.cursor !== 'number' ||
      typeof parsed.schemaVersion !== 'number' ||
      typeof parsed.bootstrapStage !== 'string' ||
      !parsed.entityCounts
    ) {
      return null;
    }
    return parsed as Checkpoint;
  } catch {
    return null;
  }
}

export function writeCheckpoint(checkpoint: Checkpoint): void {
  if (typeof window === 'undefined') return;
  // Atomic write: cursor + generation + schema + counts + stage — all or nothing.
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
}

export function clearCheckpoint(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CHECKPOINT_KEY);
  // Also clear the legacy keys that the old system left behind
  localStorage.removeItem('synq_last_seq_id');
  localStorage.removeItem('synq_store_manifest');
  localStorage.removeItem('synq_last_sync_time');
}

// ─── StoreValidator (Pure — No Side Effects) ─────────────────────────────────
// Input → Validation → Output
// Never mutates state. Never deletes data. Never syncs.

export function getCurrentEntityCounts(): EntityCounts {
  return {
    notes: useNotesStore.getState().notes.length,
    tasks: useTaskStore.getState().tasks.length,
    events: useEventStore.getState().events.length,
    projects: useProjectStore.getState().projects.length,
    folders: useFolderStore.getState().folders.length,
  };
}

export function validateStore(): StoreHealthReport {
  const checkpoint = readCheckpoint();
  const currentCounts = getCurrentEntityCounts();

  // Case 1: No checkpoint exists at all
  if (!checkpoint) {
    // Check if there's a legacy cursor orphan (old system left behind)
    const legacyCursor = typeof window !== 'undefined' 
      ? localStorage.getItem('synq_last_seq_id') 
      : null;
    
    if (legacyCursor && Number(legacyCursor) > 0) {
      // Cursor exists without checkpoint — impossible state from old system
      return {
        state: StoreHealthState.REBUILD_REQUIRED,
        recoveryType: RecoveryType.STORE_CORRUPTED,
        checkpoint: null,
        currentCounts,
        details: 'Legacy cursor exists without checkpoint. Atomic metadata was never established.',
      };
    }

    // Fresh install or clean slate — nothing to validate
    return {
      state: StoreHealthState.HEALTHY,
      checkpoint: null,
      currentCounts,
      details: 'No checkpoint found. First-time bootstrap required.',
    };
  }

  // Case 2: Bootstrap was interrupted (stage is not READY)
  if (checkpoint.bootstrapStage !== BootstrapStage.READY) {
    return {
      state: StoreHealthState.REBUILD_REQUIRED,
      recoveryType: RecoveryType.BOOTSTRAP_INTERRUPTED,
      checkpoint,
      currentCounts,
      details: `Bootstrap was interrupted at stage: ${checkpoint.bootstrapStage}. Store is not trusted.`,
    };
  }

  // Case 3: Schema version mismatch
  if (checkpoint.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      state: StoreHealthState.MIGRATION_REQUIRED,
      recoveryType: RecoveryType.SCHEMA_MISMATCH,
      checkpoint,
      currentCounts,
      details: `Schema version mismatch. Checkpoint: ${checkpoint.schemaVersion}, Current: ${CURRENT_SCHEMA_VERSION}.`,
    };
  }

  // Case 4: Entity count mismatch — stores were wiped but checkpoint survived
  const hasCountMismatch = (
    (checkpoint.entityCounts.notes > 0 && currentCounts.notes === 0) ||
    (checkpoint.entityCounts.tasks > 0 && currentCounts.tasks === 0) ||
    (checkpoint.entityCounts.events > 0 && currentCounts.events === 0) ||
    (checkpoint.entityCounts.projects > 0 && currentCounts.projects === 0) ||
    (checkpoint.entityCounts.folders > 0 && currentCounts.folders === 0)
  );

  if (hasCountMismatch) {
    return {
      state: StoreHealthState.REBUILD_REQUIRED,
      recoveryType: RecoveryType.CACHE_MISSING,
      checkpoint,
      currentCounts,
      details: 'Entity counts dropped to zero but checkpoint exists. IndexedDB was likely cleared externally.',
    };
  }

  // Case 5: All checks pass
  return {
    state: StoreHealthState.HEALTHY,
    checkpoint,
    currentCounts,
    details: 'Store is healthy. Checkpoint is valid.',
  };
}

// ─── RecoveryManager (Executes Recovery Based on Report) ──────────────────────
// Uses the StoreHealthReport to decide what to do.
// Separated from validation so they can be tested and evolved independently.

export async function executeRecovery(report: StoreHealthReport): Promise<void> {
  Telemetry.trackStoreEvent('store.rebuild.started', {
    state: report.state,
    recoveryType: report.recoveryType,
    details: report.details,
  });

  // Extract unsynced mutations before wiping
  let quarantinedMutations: Mutation[] = [];
  try {
    const pending = await MutationJournal.getPendingMutations();
    quarantinedMutations = pending;
    console.log(`[RecoveryManager] Quarantined ${pending.length} unsynced mutations.`);
  } catch (err) {
    console.error(`[RecoveryManager] Failed to read pending mutations during quarantine phase`, err);
  }

  switch (report.state) {
    case StoreHealthState.REBUILD_REQUIRED:
    case StoreHealthState.MIGRATION_REQUIRED:
      await resetStores();
      break;

    case StoreHealthState.RECOVERABLE:
      await resetStores();
      break;

    case StoreHealthState.FATAL:
      console.error('[RecoveryManager] FATAL store state. Attempting full reset as last resort.');
      await resetStores();
      break;

    default:
      return;
  }
  
  // Re-inject quarantined mutations into the newly reset journal
  if (quarantinedMutations.length > 0) {
    console.log(`[RecoveryManager] Re-injecting ${quarantinedMutations.length} mutations to new cache.`);
    for (const mut of quarantinedMutations) {
      await MutationJournal.append({
        workspace_id: mut.workspace_id,
        document_id: mut.document_id,
        client_id: mut.client_id,
        device_id: mut.device_id,
        operation_type: mut.operation_type,
        payload: mut.payload,
        dependency_ids: mut.dependency_ids,
        payload_version: mut.payload_version
      });
    }
  }

  Telemetry.trackStoreEvent('store.reset.complete', {
    recoveryType: report.recoveryType,
  });
}

async function resetStores(): Promise<void> {
  console.warn('[RecoveryManager] Store reset starting. Clearing all local state...');

  // 1. Clear Zustand in-memory stores
  useNotesStore.getState().clearStore();
  useTaskStore.getState().clearStore();
  useEventStore.getState().clearStore();
  useProjectStore.getState().clearStore();
  useFolderStore.getState().clearStore();

  // 2. Clear IndexedDB persistence
  await idbStorage.removeItem('synq-notes');
  await idbStorage.removeItem('synq-tasks');
  await idbStorage.removeItem('synq-events');
  await idbStorage.removeItem('synq-projects');
  await idbStorage.removeItem('synq-folders');
  // Note: We deliberately do NOT wipe the mutation journal here, because we already extracted pending ones,
  // but if we wanted to be perfectly clean, we could wipe the journal prefix entirely, since we re-inject them.

  // 3. Clear checkpoint atomically
  clearCheckpoint();

  console.warn('[RecoveryManager] Store reset complete. Beginning bootstrap...');
}

// ─── Bootstrap Stage Management ──────────────────────────────────────────────
// Stages: INITIALIZING → BOOTSTRAPPING → VERIFYING → READY
// A crash before READY means the next startup will detect BOOTSTRAP_INTERRUPTED.

export function beginBootstrap(): void {
  const checkpoint: Checkpoint = {
    generation: crypto.randomUUID(),
    cursor: 0,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    entityCounts: { notes: 0, tasks: 0, events: 0, projects: 0, folders: 0 },
    createdAt: new Date().toISOString(),
    bootstrapStage: BootstrapStage.BOOTSTRAPPING,
  };
  writeCheckpoint(checkpoint);
}

export function advanceBootstrapStage(stage: BootstrapStage): void {
  const checkpoint = readCheckpoint();
  if (!checkpoint) return;
  checkpoint.bootstrapStage = stage;
  writeCheckpoint(checkpoint);
}

export function finalizeBootstrap(cursor: number): void {
  const checkpoint = readCheckpoint();
  const counts = getCurrentEntityCounts();
  
  const finalized: Checkpoint = {
    generation: checkpoint?.generation || crypto.randomUUID(),
    cursor,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    entityCounts: counts,
    createdAt: checkpoint?.createdAt || new Date().toISOString(),
    bootstrapStage: BootstrapStage.READY,
  };
  writeCheckpoint(finalized);

  Telemetry.trackStoreEvent('store.bootstrap.completed', {
    cursor,
    entityCounts: counts,
  });
}

// ─── Delta Sync Checkpoint Update ────────────────────────────────────────────
// After each successful delta sync, update the checkpoint atomically.

export function updateCheckpointAfterSync(newCursor: number): void {
  const checkpoint = readCheckpoint();
  if (!checkpoint || checkpoint.bootstrapStage !== BootstrapStage.READY) return;

  const updated: Checkpoint = {
    ...checkpoint,
    cursor: newCursor,
    entityCounts: getCurrentEntityCounts(),
    createdAt: new Date().toISOString(),
  };
  writeCheckpoint(updated);
}

// ─── Background Health Check ─────────────────────────────────────────────────
// Runs periodically during idle to detect corruption before next startup.

export function runBackgroundHealthCheck(): StoreHealthReport {
  const report = validateStore();
  
  if (report.state !== StoreHealthState.HEALTHY) {
    Telemetry.trackStoreEvent('store.health.degraded', {
      state: report.state,
      details: report.details,
    });
  }

  return report;
}

// ─── Resolved Cursor ─────────────────────────────────────────────────────────
// The sync engine should ONLY get the cursor through this function.
// It never reads localStorage directly.

export function getValidatedCursor(): number {
  const checkpoint = readCheckpoint();
  if (!checkpoint) return 0;
  if (checkpoint.bootstrapStage !== BootstrapStage.READY) return 0;
  if (checkpoint.schemaVersion !== CURRENT_SCHEMA_VERSION) return 0;
  return checkpoint.cursor;
}
