import { MutationJournal, MutationState, OperationType } from './mutation-journal';
import { Dispatcher } from '@/shared/sync/dispatcher';
import { useUserStore } from '../store/use-user-store';
import { getDeviceId } from '../../lib/device-manager';

export class MutationManager {
  /**
   * Submit an intent from the UI/Editor.
   * - Persists durable record locally before returning ACK to UI.
   * - Queues it for dispatch.
   */
  static async submit(
    workspaceId: string, 
    documentId: string, 
    operationType: OperationType, 
    payload: any,
    dependencyIds: string[] = []
  ): Promise<string> {
    const userId = useUserStore.getState().user?.id || 'unknown';
    const deviceId = getDeviceId();

    const mutation = await MutationJournal.append({
      workspace_id: workspaceId,
      document_id: documentId,
      client_id: userId,
      device_id: deviceId,
      operation_type: operationType,
      payload,
      dependency_ids: dependencyIds,
      payload_version: 1,
    });

    // Acknowledge locally to the system that mutation is durable
    await MutationJournal.updateState(mutation.mutation_id, MutationState.QUEUED);

    // Notify the Dispatcher
    Dispatcher.wakeUp();

    return mutation.mutation_id;
  }
}
