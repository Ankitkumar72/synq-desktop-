import { MutationJournal, Mutation, MutationState } from './mutation-journal';
import { supabase } from '../supabase/supabase';
import { CommitManager } from '@/shared/sync/commit-manager';

// Exponential backoff strategy: Immediate -> 2s -> 5s -> 15s -> 30s -> 60s -> 5m -> 15m -> 30m -> 1h
const RETRY_DELAYS_MS = [
  0,
  2_000,
  5_000,
  15_000,
  30_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000
];

const MAX_RETRY_DELAY = 60 * 60_000; // 1 hour

function getRetryDelay(retryCount: number): number {
  if (retryCount < RETRY_DELAYS_MS.length) {
    return RETRY_DELAYS_MS[retryCount];
  }
  return MAX_RETRY_DELAY;
}

export class Dispatcher {
  private static isRunning = false;
  private static timer: ReturnType<typeof setTimeout> | null = null;

  static wakeUp() {
    if (this.isRunning) return;
    this.scheduleNextTick(0);
  }

  private static scheduleNextTick(delayMs: number) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.drainQueue().catch(console.error);
    }, delayMs);
  }

  private static async drainQueue() {
    this.isRunning = true;
    try {
      const pendingMutations = await MutationJournal.getPendingMutations();
      if (pendingMutations.length === 0) {
        this.isRunning = false;
        return;
      }

      // We process sequentially for now to guarantee topological order.
      // In advanced implementations, we can batch.
      for (const mutation of pendingMutations) {
        // Mark as dispatching
        await MutationJournal.updateState(mutation.mutation_id, MutationState.DISPATCHING);

        const success = await this.dispatchMutation(mutation);

        if (success) {
          // Commit manager handles ACK
          await CommitManager.processAck({
            mutation_id: mutation.mutation_id,
            server_sequence: 0, // In real implementation, this comes from RPC return
            server_timestamp: Date.now()
          });
        } else {
          // If it failed, it handles retry/dead-letter internally. We break to preserve ordering.
          // Wait for the next wake up or scheduled retry.
          break;
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  private static async dispatchMutation(mutation: Mutation): Promise<boolean> {
    try {
      let error;
      if (mutation.operation_type === 'NOTE_CRDT_UPDATE') {
        const payload = mutation.payload as any;
        const res = await supabase.rpc('apply_note_crdt_update', {
          p_entity_id: payload.noteId,
          p_user_id: payload.userId,
          p_client_id: payload.clientId,
          p_op_id: payload.opId,
          p_update_data: payload.updateData,
          p_body: payload.body,
          p_excerpt: payload.excerpt,
          p_hlc_timestamp: payload.fieldVersions?.body || null,
          p_updated_at: payload.updatedAt,
          p_snapshot: payload.snapshot,
          p_field_versions: payload.fieldVersions,
          p_plain_text: payload.plainText,
          p_content_markdown: payload.contentMarkdown,
          p_content: payload.content,
          p_allow_empty_body: payload.allowEmptyBody ?? false
        });
        error = res.error;
      } else {
        const res = await supabase.rpc('apply_mutations', {
          p_mutations: [mutation]
        });
        error = res.error;
      }

      if (error) {
        throw error;
      }
      
      // If server returns duplicate, we still treat as success
      return true;
    } catch (err: any) {
      const isRetryable = this.isRetryableError(err);
      
      if (isRetryable) {
        const retries = await MutationJournal.incrementRetry(mutation.mutation_id);
        await MutationJournal.updateState(mutation.mutation_id, MutationState.QUEUED);
        const delay = getRetryDelay(retries);
        console.warn(`[Dispatcher] Transient error for ${mutation.mutation_id}, retrying in ${delay}ms`);
        this.scheduleNextTick(delay);
      } else {
        console.error(`[Dispatcher] Fatal error for ${mutation.mutation_id}, moving to DLQ:`, err);
        await MutationJournal.updateState(mutation.mutation_id, MutationState.DEAD_LETTER);
        // Wake up next tick immediately to process the rest of the queue
        this.scheduleNextTick(0);
      }
      return false;
    }
  }

  private static isRetryableError(err: any): boolean {
    if (!err || typeof err !== 'object') return false;
    const status = err.status || err.statusCode || 500;
    
    // Auth or permission issues -> Not retryable immediately (requires user action)
    if (status === 401 || status === 403) return false;
    // Validation issues -> Not retryable
    if (status === 400 || status === 422) return false;
    
    const code = err.code;
    const nonRetryableCodes = ['42702', '42501', '42883', '42P01', '22P02', '23505'];
    if (code && nonRetryableCodes.includes(code)) return false;

    // Default to retry for network, 500s, rate limits, timeouts
    return true;
  }
}
