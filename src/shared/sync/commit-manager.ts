import { MutationJournal } from './mutation-journal';

export interface AckPayload {
  mutation_id: string;
  server_sequence: number;
  server_timestamp: number;
}

export class CommitManager {
  /**
   * Processes a successful acknowledgment from the server.
   */
  static async processAck(ack: AckPayload): Promise<void> {
    const mutation = await MutationJournal.getMutation(ack.mutation_id);
    if (!mutation) {
      console.warn(`[CommitManager] Received ACK for unknown mutation: ${ack.mutation_id}`);
      return;
    }

    // Move to COMMITTED, and then ARCHIVED
    await MutationJournal.archiveCommitted(ack.mutation_id);

    // Optionally update local stores with the server_sequence to maintain strict ordering
    console.log(`[CommitManager] Mutation ${ack.mutation_id} fully committed at server seq ${ack.server_sequence}`);
  }
}
