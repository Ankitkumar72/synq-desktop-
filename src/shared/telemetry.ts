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
  }
}
