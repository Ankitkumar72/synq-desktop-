import { supabase } from "@/shared"
import { useTaskStore } from "@/shared/store/use-task-store"
import { useProjectStore } from "@/shared/store/use-project-store"
import { useNotesStore } from "@/shared/store/use-notes-store"
import { useUserStore } from "@/shared/store/use-user-store"
import { useEventStore } from "@/shared/store/use-event-store"
import { useFolderStore } from "@/shared/store/use-folder-store"
import { useConflictStore } from "@/shared/store/use-conflict-store"
import { Telemetry } from "@/shared/telemetry"
import { hlc } from "@/shared/hlc"
import { 
  bindGlobalBroadcastChannel,
  NOTE_META_BROADCAST_EVENT, 
  type NoteMetaBroadcastPayload,
  getNoteSyncClientId
} from "@/shared/realtime/note-sync"
import { 
  validateStore, 
  executeRecovery, 
  beginBootstrap, 
  advanceBootstrapStage, 
  BootstrapStage, 
  finalizeBootstrap, 
  updateCheckpointAfterSync, 
  getValidatedCursor, 
  runBackgroundHealthCheck,
  StoreHealthState 
} from "@/shared/store/store-health"
import { RealtimeChannel, RealtimePostgresChangesPayload, Session } from '@supabase/supabase-js'

export enum SyncState {
  DISCONNECTED = 'DISCONNECTED',
  INITIALIZING = 'INITIALIZING',
  SYNCING = 'SYNCING',
  READY = 'READY',
  RECOVERING = 'RECOVERING',
  ERROR = 'ERROR'
}

type SyncStateListener = (state: SyncState) => void;

const POLL_INTERVAL_ACTIVE = 10_000
const POLL_INTERVAL_IDLE = 60_000
const HEALTH_CHECK_INTERVAL = 60_000
const MAX_REALTIME_RETRIES = 5
const RETRY_BASE_DELAY_MS = 2000

export class SyncEngine {
  private static instance: SyncEngine | null = null;
  
  private currentState: SyncState = SyncState.DISCONNECTED;
  private listeners: Set<SyncStateListener> = new Set();
  
  private channel: RealtimeChannel | null = null;
  private crdtChannel: RealtimeChannel | null = null;
  private activeNoteId: string | null = null;
  private currentUserId: string | null = null;
  
  private oplogBuffer: Map<string, any[]> = new Map();
  private oplogDrainTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollAt: number = 0;
  
  private realtimeConnected: boolean = false;
  private isSubscribing: boolean = false;
  private lastSubscribeAttempt: number = 0;
  private subscriptionGen: number = 0;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => this.listeners.delete(listener);
  }

  private setState(newState: SyncState) {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.listeners.forEach(l => l(newState));
  }

  public getState(): SyncState {
    return this.currentState;
  }

  public async init(session: Session | null) {
    const targetUserId = session?.user?.id || null;
    
    if (this.currentUserId === targetUserId && targetUserId !== null) {
      return; // Already initialized for this user
    }

    try {
      if (session) {
        this.setState(SyncState.INITIALIZING);
        this.currentUserId = session.user.id;
        useUserStore.getState().setUser(session.user);
        
        await this.fetchData();
        this.subscribeToRealtime();
        this.startAdaptivePolling();
        this.startHealthCheck();
        this.setState(SyncState.READY);
      } else {
        this.teardown();
      }
    } catch (err) {
      console.error('[SyncEngine] Error initializing:', err);
      this.setState(SyncState.ERROR);
    } finally {
      useUserStore.getState().setInitialized(true);
    }
  }

  public teardown() {
    this.currentUserId = null;
    this.setState(SyncState.DISCONNECTED);
    
    this.subscriptionGen++;
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.channel) {
      try { supabase.removeChannel(this.channel); } catch { /* ignore */ }
      this.channel = null;
    }
    if (this.crdtChannel) {
      try { supabase.removeChannel(this.crdtChannel); } catch { /* ignore */ }
      this.crdtChannel = null;
    }
    bindGlobalBroadcastChannel(null);
    this.realtimeConnected = false;
    this.isSubscribing = false;
    
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
  }

  public setActiveNoteId(noteId: string | null) {
    if (this.activeNoteId === noteId) return;
    this.activeNoteId = noteId;
    this.resubscribeCrdtChannel();
  }

  private resubscribeCrdtChannel() {
    if (this.crdtChannel) {
      try { supabase.removeChannel(this.crdtChannel); } catch { /* ignore */ }
      this.crdtChannel = null;
    }

    const noteId = this.activeNoteId;
    if (!noteId) return;

    this.crdtChannel = supabase
      .channel(`crdt:${noteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crdt_documents', filter: `entity_id=eq.${noteId}` }, this.handleRemoteCRDT)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crdt_note_updates', filter: `entity_id=eq.${noteId}` }, this.handleRemoteCrdtNoteUpdate)
      .on('broadcast', { event: NOTE_META_BROADCAST_EVENT }, () => {}); // we'll use worker for this in future

    this.crdtChannel.subscribe();
  }

  public async fetchData() {
    try {
      Telemetry.trackStoreEvent('store.validation.started');
      const healthReport = validateStore();
      let lastSeqId = getValidatedCursor();

      if (healthReport.state !== StoreHealthState.HEALTHY) {
        this.setState(SyncState.RECOVERING);
        Telemetry.trackStoreEvent('store.validation.failed', {
          state: healthReport.state,
          recoveryType: healthReport.recoveryType,
          details: healthReport.details,
        });
        await executeRecovery(healthReport);
        lastSeqId = 0;
      }

      this.setState(SyncState.SYNCING);
      
      const isFullBootstrap = lastSeqId === 0;
      if (isFullBootstrap) {
        beginBootstrap();
      }
      
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.rpc('get_delta_sync', { 
          p_last_seq_id: lastSeqId,
          p_limit: 1000 // Pagination limit
        });

        if (error) {
          if ((error as any).code !== 'PGRST202') {
            console.error('[SyncEngine] Error fetching delta sync data:', error);
          }
          await this.fallbackFetch();
          this.setState(SyncState.READY);
          return;
        }

        if (data) {
          if (isFullBootstrap) {
            advanceBootstrapStage(BootstrapStage.VERIFYING);
          }

          const promises = [
            useTaskStore.getState().fetchTasks(true, data.tasks),
            useNotesStore.getState().fetchNotes(true, data.notes),
            useEventStore.getState().fetchEvents(true, data.events),
            useProjectStore.getState().fetchProjects(true, data.projects),
            useFolderStore.getState().fetchFolders(true, data.folders),
            useConflictStore.getState().fetchConflicts()
          ];
          await Promise.allSettled(promises);
          
          if (data.latest_seq_id !== undefined) {
            if (isFullBootstrap) {
              finalizeBootstrap(data.latest_seq_id);
            } else {
              updateCheckpointAfterSync(data.latest_seq_id);
            }
            lastSeqId = data.latest_seq_id;
          }
          
          this.hydrateMissingNoteContent(data.notes);

          // If we received fewer records than the limit across all types, we are done
          const totalRecords = (data.tasks?.length || 0) + (data.notes?.length || 0) + (data.events?.length || 0) + (data.projects?.length || 0) + (data.folders?.length || 0);
          if (totalRecords < 1000) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      this.setState(SyncState.READY);
    } catch (err) {
      console.error('[SyncEngine] Unexpected error in fetchData:', err);
      this.setState(SyncState.ERROR);
    }
  }

  private async fallbackFetch() {
    const fetchFns = [
      () => useTaskStore.getState().fetchTasks(),
      () => useNotesStore.getState().fetchNotes(),
      () => useEventStore.getState().fetchEvents(),
      () => useProjectStore.getState().fetchProjects(),
      () => useFolderStore.getState().fetchFolders(),
      () => useConflictStore.getState().fetchConflicts()
    ];
    await Promise.allSettled(fetchFns.map(fn => fn().catch(e => console.error(e))));
  }

  private hydrateMissingNoteContent(notes: any) {
    if (!notes || !Array.isArray(notes)) return;
    const missingContentNotes = notes.filter((n: any) => !n.content && !n.body);
    if (missingContentNotes.length === 0) return;
    
    setTimeout(() => {
      const fetchChunks = async () => {
        const chunkSize = 50;
        for (let i = 0; i < missingContentNotes.length; i += chunkSize) {
          const chunk = missingContentNotes.slice(i, i + chunkSize);
          const ids = chunk.map((n: any) => n.id);
          try {
            const { data: contents } = await supabase.rpc('get_note_content', { p_note_ids: ids });
            if (contents && Array.isArray(contents)) {
              contents.forEach((c: any) => {
                useNotesStore.getState().updateNoteLocal(c.id, {
                  content: c.content,
                  body: c.body,
                  plain_text: c.plain_text,
                  excerpt: c.excerpt,
                  content_markdown: c.content_markdown,
                  field_versions: c.field_versions
                });
              });
            }
          } catch { /* ignore */ }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      };
      void fetchChunks();
    }, 1000);
  }

  private async subscribeToRealtime(attempt = 0) {
    if (this.isSubscribing && attempt === 0) return;
    const userId = this.currentUserId;
    if (!userId) return;

    this.isSubscribing = true;
    this.lastSubscribeAttempt = Date.now();
    const currentGen = ++this.subscriptionGen;

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.channel) {
      try { supabase.removeChannel(this.channel); } catch { /* ignore */ }
      this.channel = null;
      bindGlobalBroadcastChannel(null);
      this.realtimeConnected = false;
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.isSubscribing = false;
      return;
    }
    await supabase.realtime.setAuth(session.access_token);

    const channel = supabase
      .channel(`synq:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, this.handleRemoteTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, this.handleRemoteProjects)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, this.handleRemoteEvents)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, this.handleRemoteFolders)
      .on('broadcast', { event: NOTE_META_BROADCAST_EVENT }, (payload: any) => this.handleRemoteNoteMetaBroadcast(payload.payload as NoteMetaBroadcastPayload));

    this.channel = channel;

    channel.subscribe((status: string) => {
      if (this.subscriptionGen !== currentGen) return;

      if (status === 'SUBSCRIBED') {
        this.realtimeConnected = true;
        this.isSubscribing = false;
        bindGlobalBroadcastChannel(channel);
        if (attempt > 0) {
          this.fetchData().catch(e => console.error('[SyncEngine] Reconnect sync failed:', e));
        }
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        this.realtimeConnected = false;
        bindGlobalBroadcastChannel(null);
        Telemetry.trackRealtimeReconnect(attempt, status);

        if (attempt < MAX_REALTIME_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          this.retryTimeout = setTimeout(() => this.subscribeToRealtime(attempt + 1), delay);
        } else {
          this.isSubscribing = false;
        }
      }
    });
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      setTimeout(() => {
        if (document.visibilityState === 'visible' && !this.realtimeConnected && this.currentUserId) {
          this.subscribeToRealtime();
        }
      }, 500);
    }
  }

  private startAdaptivePolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    let isCurrentlyPolling = false;

    this.pollTimer = setInterval(async () => {
      if (isCurrentlyPolling) return;
      const now = Date.now();
      const timeSinceLastPoll = now - this.lastPollAt;
      const isHidden = typeof document !== 'undefined' && document.hidden;
      const targetInterval = isHidden ? POLL_INTERVAL_IDLE : POLL_INTERVAL_ACTIVE;

      if (timeSinceLastPoll >= targetInterval) {
        this.lastPollAt = now;
        isCurrentlyPolling = true;
        try {
          if (this.currentState === SyncState.READY) {
            await this.fetchData();
          }
        } finally {
          isCurrentlyPolling = false;
        }
      }
    }, 1000);
  }

  private startHealthCheck() {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!this.currentUserId || this.isSubscribing) return;
      
      if (!this.realtimeConnected) this.subscribeToRealtime();

      const bgReport = runBackgroundHealthCheck();
      if (bgReport.state !== StoreHealthState.HEALTHY) {
        this.setState(SyncState.RECOVERING);
        this.fetchData(); // fetchData triggers recovery
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  // --- Remote Handlers ---
  
  private handleRemoteTasks = (payload: RealtimePostgresChangesPayload<any>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const store = useTaskStore.getState();
    if (newRecord?.hlc_timestamp) hlc.receive(newRecord.hlc_timestamp);

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      store.mergeTaskLocal(newRecord);
    } else if (eventType === 'DELETE' && oldRecord?.id) {
      store.setTasks(store.tasks.filter(t => t.id !== oldRecord.id));
    }
  }

  private handleRemoteProjects = (payload: RealtimePostgresChangesPayload<any>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const store = useProjectStore.getState();
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      store.mergeProjectLocal(newRecord);
    } else if (eventType === 'DELETE' && oldRecord?.id) {
      store.setProjects(store.projects.filter(p => p.id !== oldRecord.id));
    }
  }

  private handleRemoteEvents = (payload: RealtimePostgresChangesPayload<any>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const store = useEventStore.getState();
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      store.mergeEventLocal(newRecord);
    } else if (eventType === 'DELETE' && oldRecord?.id) {
      store.setEvents(store.events.filter(e => e.id !== oldRecord.id));
    }
  }

  private handleRemoteFolders = (payload: RealtimePostgresChangesPayload<any>) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const store = useFolderStore.getState();
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      store.mergeFolderLocal(newRecord);
    } else if (eventType === 'DELETE' && oldRecord?.id) {
      store.setFolders(store.folders.filter(f => f.id !== oldRecord.id));
    }
  }

  private handleRemoteNoteMetaBroadcast = (payload: NoteMetaBroadcastPayload) => {
    if (payload.sender_id === getNoteSyncClientId()) return;
    const store = useNotesStore.getState();
    const existing = store.notes.find(note => note.id === payload.id);
    if (!existing) return;
    
    store.mergeNoteLocal({
      ...existing,
      ...payload
    });
  }

  private handleRemoteCRDT = () => {
    // In Hybrid architecture, we can offload applying remote updates to worker later.
    // For now, it will be piped to worker or handled by sync-manager.
  }

  private handleRemoteCrdtNoteUpdate = () => {
    // Pipe to worker in Hybrid architecture
  }
}
