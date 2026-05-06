# Docs-Grade Sync Rollout (Notion/Google-Docs Target)

## Goal
Move from snapshot-oriented sync to operation-oriented collaborative sync with:
1. atomic writes,
2. idempotent replay,
3. realtime fanout,
4. robust offline recovery.

## Schema/RPC Added
Migration: `supabase/migrations/20260506_crdt_oplog_atomic.sql`

### New table
- `public.crdt_note_updates`
  - append-only incremental Yjs updates
  - idempotency key: `(entity_type, entity_id, op_id)`
  - ordered by `seq` for replay/catch-up

### New RPC
1. `apply_note_crdt_update(...)`
   - atomic transaction:
     - append op-log row
     - update `notes.body/excerpt/hlc_timestamp/updated_at`
     - optional snapshot upsert into `crdt_documents`
   - idempotent by `op_id`

2. `get_note_crdt_updates(...)`
   - replay updates after `seq` cursor
   - bounded with `limit`

## Client Contract
Implemented helpers: `src/lib/crdt/oplog.ts`

### Write path
Use `applyNoteCrdtUpdate` with:
- `noteId`
- `userId`
- `clientId`
- `opId` (unique per local mutation)
- `updateData` (incremental Yjs update)
- `body`, `excerpt`
- optional `snapshot` (periodic, not every keystroke)

### Catch-up path
Use `getNoteCrdtUpdates(noteId, lastSeq)` and apply each `update_data` to the local Y.Doc in order.

## Rollout Plan
1. **Phase A (Shadow)**
   - keep existing snapshot save path
   - add parallel op-log writes through RPC
   - compare op-log seq growth and snapshot consistency

2. **Phase B (Read Catch-up)**
   - on editor load:
     - load snapshot from `crdt_documents`
     - fetch/replay ops after saved `last_seq`
   - persist `last_seq` per note locally

3. **Phase C (Realtime Op Fanout)**
   - subscribe to `crdt_note_updates` for note id
   - apply incoming ops immediately
   - keep note broadcast only for awareness/UX hints

4. **Phase D (Compaction)**
   - periodic worker:
     - fold op-log into new snapshot
     - prune old ops up to compaction watermark

## Edge Cases To Validate
1. Duplicate op retries (`op_id` replay) -> no double-apply
2. Out-of-order deliveries -> sorted by `seq` before apply
3. Reconnect after long offline -> snapshot + op replay
4. Two editors simultaneous typing -> deterministic convergence
5. Refresh during rapid Enter/newline typing -> exact blank-line fidelity
6. Partial failure (network drop after RPC return uncertain) -> idempotent retry by same `op_id`

## Operational SLOs
1. `write->remote-render` p95 < 300ms
2. `offline replay success` = 100%
3. `dropped ops` = 0
4. `sync divergence incidents` = 0
