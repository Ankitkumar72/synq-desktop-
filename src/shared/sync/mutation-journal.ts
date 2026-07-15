import { get, set, keys, del } from 'idb-keyval';
import { v7 as uuidv7 } from 'uuid';

export enum MutationState {
  CREATED = 'CREATED',
  PERSISTED = 'PERSISTED',
  QUEUED = 'QUEUED',
  DISPATCHING = 'DISPATCHING',
  AWAITING_ACK = 'AWAITING_ACK',
  COMMITTED = 'COMMITTED',
  ARCHIVED = 'ARCHIVED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export type OperationType = 
  | 'NOTE_CRDT_UPDATE'
  | 'NOTE_CREATE'
  | 'NOTE_UPDATE'
  | 'NOTE_DELETE'
  | 'TASK_CREATE'
  | 'TASK_UPDATE'
  | 'FOLDER_CREATE'
  | 'FOLDER_MOVE';

export interface Mutation {
  mutation_id: string; // UUIDv7
  workspace_id: string;
  document_id: string; // the entity id (note/task/folder id)
  client_id: string;
  device_id: string;
  operation_type: OperationType;
  payload: any;
  state: MutationState;
  created_at: number;
  retry_count: number;
  dependency_ids: string[];
  payload_version: number;
}

const JOURNAL_PREFIX = 'synq-mutation-journal:';

export class MutationJournal {
  static async append(mutationInput: Omit<Mutation, 'mutation_id' | 'state' | 'created_at' | 'retry_count'>): Promise<Mutation> {
    const mutation: Mutation = {
      ...mutationInput,
      mutation_id: uuidv7(),
      state: MutationState.PERSISTED,
      created_at: Date.now(),
      retry_count: 0,
    };
    await set(`${JOURNAL_PREFIX}${mutation.mutation_id}`, mutation);
    return mutation;
  }

  static async getMutation(mutationId: string): Promise<Mutation | undefined> {
    return await get<Mutation>(`${JOURNAL_PREFIX}${mutationId}`);
  }

  static async updateState(mutationId: string, state: MutationState): Promise<void> {
    const mutation = await get<Mutation>(`${JOURNAL_PREFIX}${mutationId}`);
    if (mutation) {
      mutation.state = state;
      await set(`${JOURNAL_PREFIX}${mutationId}`, mutation);
    }
  }

  static async incrementRetry(mutationId: string): Promise<number> {
    const mutation = await get<Mutation>(`${JOURNAL_PREFIX}${mutationId}`);
    if (mutation) {
      mutation.retry_count += 1;
      await set(`${JOURNAL_PREFIX}${mutationId}`, mutation);
      return mutation.retry_count;
    }
    return 0;
  }

  static async getPendingMutations(): Promise<Mutation[]> {
    const allKeys = await keys();
    const journalKeys = (allKeys as string[]).filter(k => typeof k === 'string' && k.startsWith(JOURNAL_PREFIX));
    
    const mutations: Mutation[] = [];
    for (const key of journalKeys) {
      const mut = await get<Mutation>(key);
      if (mut && (mut.state === MutationState.QUEUED || mut.state === MutationState.DISPATCHING)) {
        mutations.push(mut);
      }
    }
    return mutations.sort((a, b) => a.created_at - b.created_at);
  }
  
  static async getDeadLetters(): Promise<Mutation[]> {
    const allKeys = await keys();
    const journalKeys = (allKeys as string[]).filter(k => typeof k === 'string' && k.startsWith(JOURNAL_PREFIX));
    
    const mutations: Mutation[] = [];
    for (const key of journalKeys) {
      const mut = await get<Mutation>(key);
      if (mut && mut.state === MutationState.DEAD_LETTER) {
        mutations.push(mut);
      }
    }
    return mutations.sort((a, b) => a.created_at - b.created_at);
  }

  static async archiveCommitted(mutationId: string): Promise<void> {
    const mutation = await get<Mutation>(`${JOURNAL_PREFIX}${mutationId}`);
    if (mutation) {
      mutation.state = MutationState.ARCHIVED;
      await set(`${JOURNAL_PREFIX}${mutationId}`, mutation);
    }
  }

  static async delete(mutationId: string): Promise<void> {
    await del(`${JOURNAL_PREFIX}${mutationId}`);
  }
}
