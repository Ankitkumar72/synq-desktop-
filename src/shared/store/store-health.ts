/**
 * Validated Startup Pipeline for Synq Desktop
 * 
 * Architecture:
 *   Application → StoreValidator → StoreHealthReport
 * 
 * The StoreValidator is a pure function: Input → Validation → Output (no side effects).
 * The BootstrapCoordinator consumes the report and executes the appropriate atomic recovery strategy.
 * All sync metadata (cursor, generation, schema version) is persisted atomically
 * in a single Checkpoint object — they can never exist independently.
 * 
 * Bootstrap is staged: INITIALIZING → BOOTSTRAPPING → VERIFYING → READY
 * A crash at any stage before READY means the store is not trusted on next startup, unless the Watchdog heartbeat is active.
 */

import { useNotesStore } from './use-notes-store';
import { useTaskStore } from './use-task-store';
import { useEventStore } from './use-event-store';
import { useProjectStore } from './use-project-store';
import { useFolderStore } from './use-folder-store';
import { Telemetry } from '../telemetry';

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

export enum StoreTrustLevel {
  TRUSTED = 'TRUSTED',
  UNTRUSTED = 'UNTRUSTED',
  DEGRADED = 'DEGRADED',
  BOOTSTRAPPING_IN_PROGRESS = 'BOOTSTRAPPING_IN_PROGRESS',
}

export enum RecoveryType {
  STORE_CORRUPTED = 'STORE_CORRUPTED',
  CACHE_MISSING = 'CACHE_MISSING',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  BOOTSTRAP_INTERRUPTED = 'BOOTSTRAP_INTERRUPTED',
}

export interface StoreHealthReport {
  level: StoreTrustLevel;
  recoveryType?: RecoveryType;
  checkpoint: Checkpoint | null;
  currentCounts: EntityCounts;
  details: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHECKPOINT_KEY = 'synq_checkpoint';
const HEARTBEAT_KEY = 'synq_bootstrap_heartbeat';
const CURRENT_SCHEMA_VERSION = 2;
const HEARTBEAT_TIMEOUT_MS = 30000; // 30 seconds

// ─── Checkpoint Persistence (Atomic) ─────────────────────────────────────────

export function readCheckpoint(): Checkpoint | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CHECKPOINT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
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
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
}

export function clearCheckpoint(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CHECKPOINT_KEY);
  localStorage.removeItem('synq_last_seq_id');
  localStorage.removeItem('synq_store_manifest');
  localStorage.removeItem('synq_last_sync_time');
}

// ─── Watchdog Heartbeat ───────────────────────────────────────────────────────

export function pulseHeartbeat(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
}

export function isHeartbeatActive(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(HEARTBEAT_KEY);
  if (!raw) return false;
  const lastPulse = parseInt(raw, 10);
  if (isNaN(lastPulse)) return false;
  return (Date.now() - lastPulse) < HEARTBEAT_TIMEOUT_MS;
}

// ─── StoreValidator (Pure — No Side Effects) ─────────────────────────────────

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

  if (!checkpoint) {
    const legacyCursor = typeof window !== 'undefined' 
      ? localStorage.getItem('synq_last_seq_id') 
      : null;
    
    if (legacyCursor && Number(legacyCursor) > 0) {
      return {
        level: StoreTrustLevel.UNTRUSTED,
        recoveryType: RecoveryType.STORE_CORRUPTED,
        checkpoint: null,
        currentCounts,
        details: 'Legacy cursor exists without checkpoint. Atomic metadata was never established.',
      };
    }

    return {
      level: StoreTrustLevel.TRUSTED,
      checkpoint: null,
      currentCounts,
      details: 'No checkpoint found. First-time bootstrap required.',
    };
  }

  // Check Watchdog heartbeat for active bootstrapping
  if (checkpoint.bootstrapStage !== BootstrapStage.READY) {
    if (isHeartbeatActive()) {
      return {
        level: StoreTrustLevel.BOOTSTRAPPING_IN_PROGRESS,
        checkpoint,
        currentCounts,
        details: `Bootstrap is actively running (stage: ${checkpoint.bootstrapStage}). Watchdog heartbeat is fresh.`,
      };
    }
    
    return {
      level: StoreTrustLevel.UNTRUSTED,
      recoveryType: RecoveryType.BOOTSTRAP_INTERRUPTED,
      checkpoint,
      currentCounts,
      details: `Bootstrap was interrupted at stage: ${checkpoint.bootstrapStage}. Watchdog heartbeat is dead. Store is not trusted.`,
    };
  }

  if (checkpoint.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      level: StoreTrustLevel.UNTRUSTED,
      recoveryType: RecoveryType.SCHEMA_MISMATCH,
      checkpoint,
      currentCounts,
      details: `Schema version mismatch. Checkpoint: ${checkpoint.schemaVersion}, Current: ${CURRENT_SCHEMA_VERSION}.`,
    };
  }

  const hasCountMismatch = (
    (checkpoint.entityCounts.notes > 0 && currentCounts.notes === 0) ||
    (checkpoint.entityCounts.tasks > 0 && currentCounts.tasks === 0) ||
    (checkpoint.entityCounts.events > 0 && currentCounts.events === 0) ||
    (checkpoint.entityCounts.projects > 0 && currentCounts.projects === 0) ||
    (checkpoint.entityCounts.folders > 0 && currentCounts.folders === 0)
  );

  if (hasCountMismatch) {
    return {
      level: StoreTrustLevel.UNTRUSTED,
      recoveryType: RecoveryType.CACHE_MISSING,
      checkpoint,
      currentCounts,
      details: 'Entity counts dropped to zero but checkpoint exists. IndexedDB was likely cleared externally.',
    };
  }

  return {
    level: StoreTrustLevel.TRUSTED,
    checkpoint,
    currentCounts,
    details: 'Store is trusted and healthy. Checkpoint is valid.',
  };
}

// ─── Legacy Recovery Stub ────────────────────────────────────────────────────
// These will be removed soon, left here momentarily so imports in sync-engine.ts don't crash
// while we implement the new BootstrapCoordinator.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function executeRecovery(_report: StoreHealthReport): Promise<void> {
  console.warn('[StoreHealth] executeRecovery is deprecated. BootstrapCoordinator should handle this.');
}
export enum StoreHealthState {
  HEALTHY = 'HEALTHY',
  REBUILD_REQUIRED = 'REBUILD_REQUIRED',
  MIGRATION_REQUIRED = 'MIGRATION_REQUIRED',
  RECOVERABLE = 'RECOVERABLE',
  FATAL = 'FATAL',
}

// ─── Bootstrap Stage Management ──────────────────────────────────────────────

export function beginBootstrap(): void {
  const checkpoint: Checkpoint = {
    generation: crypto.randomUUID(),
    cursor: -1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    entityCounts: { notes: 0, tasks: 0, events: 0, projects: 0, folders: 0 },
    createdAt: new Date().toISOString(),
    bootstrapStage: BootstrapStage.BOOTSTRAPPING,
  };
  writeCheckpoint(checkpoint);
  pulseHeartbeat();
}

export function advanceBootstrapStage(stage: BootstrapStage): void {
  const checkpoint = readCheckpoint();
  if (!checkpoint) return;
  checkpoint.bootstrapStage = stage;
  writeCheckpoint(checkpoint);
  pulseHeartbeat();
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

export function runBackgroundHealthCheck(): StoreHealthReport {
  const report = validateStore();
  
  if (report.level === StoreTrustLevel.UNTRUSTED || report.level === StoreTrustLevel.DEGRADED) {
    Telemetry.trackStoreEvent('store.health.degraded', {
      level: report.level,
      details: report.details,
    });
  }

  return report;
}

// ─── Resolved Cursor ─────────────────────────────────────────────────────────

export function getValidatedCursor(): number {
  const checkpoint = readCheckpoint();
  if (!checkpoint) return -1;
  if (checkpoint.bootstrapStage !== BootstrapStage.READY) return -1;
  if (checkpoint.schemaVersion !== CURRENT_SCHEMA_VERSION) return -1;
  return checkpoint.cursor;
}
