**1. Recommended RPC Signature**

I’d make the note-write RPC the single atomic write path for editor persistence, and I’d make it explicit about “field present” vs “field omitted” so `NULL` can be written intentionally.

```sql
CREATE OR REPLACE FUNCTION public.apply_note_crdt_update(
  p_entity_id UUID,
  p_user_id UUID,
  p_client_id TEXT,
  p_op_id TEXT,
  p_update_data BIGINT[],
  p_hlc_timestamp TEXT,
  p_updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  p_snapshot BIGINT[] DEFAULT NULL,

  p_body TEXT DEFAULT NULL,
  p_excerpt TEXT DEFAULT NULL,
  p_content JSONB DEFAULT NULL,
  p_content_markdown TEXT DEFAULT NULL,
  p_field_versions JSONB DEFAULT '{}'::jsonb,

  p_set_body BOOLEAN DEFAULT false,
  p_set_excerpt BOOLEAN DEFAULT false,
  p_set_content BOOLEAN DEFAULT false,
  p_set_content_markdown BOOLEAN DEFAULT false
)
RETURNS TABLE(applied BOOLEAN, seq BIGINT)
```

And inside the `UPDATE public.notes`:

```sql
UPDATE public.notes n
SET
  body = CASE WHEN p_set_body THEN p_body ELSE n.body END,
  excerpt = CASE WHEN p_set_excerpt THEN p_excerpt ELSE n.excerpt END,
  content = CASE WHEN p_set_content THEN p_content ELSE n.content END,
  content_markdown = CASE WHEN p_set_content_markdown THEN p_content_markdown ELSE n.content_markdown END,
  field_versions = COALESCE(n.field_versions, '{}'::jsonb) || COALESCE(p_field_versions, '{}'::jsonb),
  hlc_timestamp = p_hlc_timestamp,
  updated_at = COALESCE(p_updated_at, timezone('utc'::text, now()))
WHERE n.id = p_entity_id
  AND n.user_id = p_user_id;
```

Why this is the safest version:

- It makes CRDT state, note projections, and field versions atomic.
- It avoids the `COALESCE(p_content, n.content)` bug where you can’t intentionally write `NULL`.
- It keeps `content`, `body`, and `content_markdown` aligned in one transaction.
- It works cleanly with your current merge logic in [src/shared/store/use-notes-store.ts](</D:/Synq Desktop/src/shared/store/use-notes-store.ts:279>) and CRDT flow in [src/shared/crdt/oplog.ts](</D:/Synq Desktop/src/shared/crdt/oplog.ts:69>).

**2. Safer Phase 3 Alternative**

I would not reintroduce a trigger that inserts into `tasks`/`events` and then deletes from `notes`.

The safer alternative is:

1. Keep `notes`, `tasks`, and `events` authoritative and separate.
2. Create a dedicated RPC like `public.ingest_legacy_note_item(...)` for old-client payloads.
3. Only legacy clients call that RPC.
4. The RPC writes directly to `tasks` or `events`, never to `notes`.
5. Run a one-time migration/backfill for existing bad legacy rows in `notes`.
6. Add a DB constraint or policy later so new web-created note rows cannot carry `is_task=true` or `scheduled_time IS NOT NULL`.

Recommended rollout:

- Step 1: Backfill existing legacy rows from `notes` into `tasks`/`events`.
- Step 2: Delete or archive those migrated rows from `notes`.
- Step 3: Add a check constraint for modern clients.
- Step 4: Keep legacy compatibility through RPC, not hidden triggers.

This is safer because:

- No surprise delete during note save.
- No recursive trigger/realtime weirdness.
- No ghost-row behavior from cross-table mutation side effects.
- Much easier to audit and monitor.

**3. Scale Roadmap: Next 3 Milestones**

**Milestone 1: Correctness First**
- Ship the atomic note RPC.
- Remove the second client-side `notes.update(...)` in [src/shared/crdt/oplog.ts](</D:/Synq Desktop/src/shared/crdt/oplog.ts:94>).
- Version `content`, `content_markdown`, `body`, and `excerpt` together.
- Add a migration to clean existing legacy note/task/event overlap.
- Add backend metrics for RPC failure rate, queue depth, CRDT seq lag, and realtime reconnects.

**Milestone 2: Sync Efficiency**
- Replace full bootstrap with delta sync by `updated_at` or cursor.
- Keep CRDT realtime only for actively opened notes.
- Use lighter list payloads for sidebar, dashboard, and calendar views.
- Move bulk task/event operations into RPCs instead of many client writes.
- Add pagination and bounded fetches for notes, tasks, and events.

**Milestone 3: Scale Hardening**
- Add stricter DB constraints so `notes` cannot accept legacy task/event-shaped rows from modern clients.
- Add partial indexes for active records by `user_id` and `updated_at`.
- Add archival/compaction policy for `crdt_note_updates`.
- Consider partitioning or archival for high-volume oplog/history tables.
- Add observability dashboards and alerting for sync divergence, stale queues, and bootstrap latency.



