/**
 * Structured telemetry for tracking sync health, CRDT performance, and backend reliability.
 * Currently uses structured JSON console logging. 
 * Once stable, these functions can be wired directly to Datadog or Sentry SDKs.
 */

export const Telemetry = {
  /**
   * Tracks success/failure of RPC calls to Supabase.
   */
  trackRpcResult: (rpcName: string, success: boolean, error?: unknown) => {
    const payload = {
      event: 'rpc_result',
      rpcName,
      success,
      error: error instanceof Error ? error.message : String(error || ''),
      timestamp: new Date().toISOString(),
    }
    
    if (success) {
      console.info(`[Telemetry] RPC Success: ${rpcName}`, payload)
    } else {
      console.error(`[Telemetry] RPC Failed: ${rpcName}`, payload)
    }
  },

  /**
   * Tracks mutation lifecycle events for the Production-Grade Delivery System.
   */
  trackMutation: (
    event: 'mutation_queued' | 'mutation_dispatched' | 'mutation_committed' | 'mutation_dead_letter' | 'mutation_retry',
    mutationId: string,
    metadata?: Record<string, unknown>
  ) => {
    const payload = {
      event,
      mutation_id: mutationId,
      ...metadata,
      timestamp: new Date().toISOString(),
    }
    
    if (event === 'mutation_dead_letter' || event === 'mutation_retry') {
      console.warn(`[Telemetry] Mutation ${event}: ${mutationId}`, payload)
    } else {
      console.info(`[Telemetry] Mutation ${event}: ${mutationId}`, payload)
    }
  },

  /**
   * Tracks the number of items in the offline queues during a flush cycle.
   */
  trackQueueDepth: (crudDepth: number, crdtDepth: number) => {
    if (crudDepth === 0 && crdtDepth === 0) return

    const payload = {
      event: 'queue_depth',
      crudDepth,
      crdtDepth,
      timestamp: new Date().toISOString(),
    }
    
    console.info(`[Telemetry] Queue Depth - CRUD: ${crudDepth}, CRDT: ${crdtDepth}`, payload)
  },

  /**
   * Tracks CRDT sequence lag when receiving realtime updates.
   * Helps identify if clients are falling behind on the oplog.
   */
  trackCrdtLag: (noteId: string, lag: number, action: 'monitor' | 'warning' | 'force_resync' = 'monitor') => {
    const payload = {
      event: 'crdt_lag',
      noteId,
      lag,
      action,
      timestamp: new Date().toISOString(),
    }
    
    if (action === 'force_resync') {
      console.error(`[Telemetry] Critical CRDT Lag: ${lag} ops behind on ${noteId}. Forcing resync.`, payload)
    } else if (action === 'warning') {
      console.warn(`[Telemetry] High CRDT Lag: ${lag} ops behind on ${noteId}.`, payload)
    } else {
      console.debug(`[Telemetry] CRDT Lag: ${lag} ops behind on ${noteId}.`, payload)
    }
  },

  /**
   * Tracks when the Supabase Realtime channel drops and has to reconnect.
   */
  trackRealtimeReconnect: (attempt: number, reason: string) => {
    const payload = {
      event: 'realtime_reconnect',
      attempt,
      reason,
      timestamp: new Date().toISOString(),
    }
    
    console.warn(`[Telemetry] Realtime Reconnecting (Attempt ${attempt}) due to ${reason}`, payload)
  },

  /**
   * Tracks store validation, recovery, and bootstrap lifecycle events.
   * Events: store.validation.started, store.validation.failed, store.rebuild.started,
   *         store.reset.complete, store.bootstrap.completed, store.health.degraded
   */
  trackStoreEvent: (event: string, data?: Record<string, unknown>) => {
    const payload = {
      event,
      ...data,
      timestamp: new Date().toISOString(),
    }

    const isError = event.includes('failed') || event.includes('degraded') || event.includes('rebuild')
    if (isError) {
      console.warn(`[Telemetry] ${event}`, payload)
    } else {
      console.info(`[Telemetry] ${event}`, payload)
    }
  },

  /**
   * Tracks note loading and hydration pipeline for Phase 17 debugging.
   */
  trackNoteLoad: (
    noteId: string,
    metadata: {
      schema_version?: number;
      content_size?: number;
      content_hash?: string;
      body_hash?: string;
      hydration_duration?: number;
      editor_ready?: boolean;
      provider_synced?: boolean;
      render_complete?: boolean;
      error?: string;
    }
  ) => {
    const payload = {
      event: 'note_load',
      note_id: noteId,
      ...metadata,
      timestamp: new Date().toISOString(),
    }
    
    if (metadata.error) {
      console.error(`[Telemetry] Note Load Failed: ${noteId}`, payload)
    } else {
      console.info(`[Telemetry] Note Load: ${noteId}`, payload)
    }
  }
}
