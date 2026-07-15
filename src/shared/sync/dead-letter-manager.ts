import { MutationJournal, Mutation, MutationState } from './mutation-journal';

export class DeadLetterManager {
  /**
   * Retrieves all mutations that have permanently failed validation,
   * permissions, or hit an unrecoverable state.
   */
  static async getDeadLetters(): Promise<Mutation[]> {
    return await MutationJournal.getDeadLetters();
  }

  /**
   * Allows the user to manually retry a dead-lettered mutation.
   */
  static async retryMutation(mutationId: string): Promise<void> {
    const mutation = await MutationJournal.getMutation(mutationId);
    if (!mutation || mutation.state !== MutationState.DEAD_LETTER) return;

    // Reset state to QUEUED and trigger the dispatcher
    await MutationJournal.updateState(mutationId, MutationState.QUEUED);
    // Note: The caller should invoke Dispatcher.wakeUp()
  }

  /**
   * Allows the user to discard a dead-lettered mutation permanently.
   */
  static async discardMutation(mutationId: string): Promise<void> {
    await MutationJournal.delete(mutationId);
  }

  /**
   * Exports the dead letters as a JSON string for support/backup.
   */
  static async exportDeadLetters(): Promise<string> {
    const letters = await this.getDeadLetters();
    return JSON.stringify(letters, null, 2);
  }
}
