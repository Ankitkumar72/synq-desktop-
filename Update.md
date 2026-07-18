
````md
# Synq Database Architecture — Production Hardening & 10/10 Engineering Audit

## Role

Act as a Principal/Staff-level Database, Distributed Systems, Security, and Backend Engineer responsible for taking Synq's current architecture from a competent production system to a rigorously engineered, production-grade architecture.

The quality bar should be inspired by publicly documented engineering principles associated with mature systems such as:

- Google-style schema rigor and explicit contracts
- Notion-style disciplined content/data modeling
- Privacy-first data minimization principles
- Supabase/PostgreSQL production best practices
- Local-first/offline-first distributed systems
- CRDT-based collaborative systems
- Multi-device synchronization systems
- Zero-trust security principles
- Strong tenant isolation
- Safe, forward-only database migrations

Do NOT claim access to or knowledge of private internal architectures belonging to Google, Notion, Morgen, or any other company.

The goal is not to copy another company's private architecture.

The goal is to make Synq independently meet a measurable, defensible 10/10 engineering standard.

---

# 1. Mission

Perform a complete audit and hardening of the Synq database and synchronization architecture.

The current assessment identified potential weaknesses in:

1. Schema/type rigor
2. Nullable core fields
3. Unconstrained text-based state fields
4. Content-model redundancy
5. Duplicate device tracking
6. Inconsistent data types
7. Data minimization
8. OAuth token security
9. Sync architecture overlap
10. CRDT vs HLC responsibility boundaries
11. Referential integrity
12. Foreign keys
13. Unique constraints
14. Indexing
15. Row Level Security
16. Tenant isolation
17. Migration discipline
18. Database testing
19. Sync testing
20. Security testing
21. Observability
22. Disaster recovery
23. Performance
24. Production readiness

Your task is to investigate every one of these areas.

Do not assume the assessment is correct.

Prove or disprove every finding using the actual repository, migrations, SQL, application code, generated database types, and Supabase configuration.

---

# 2. Non-Negotiable Engineering Rules

## Rule 1 — Audit before changing

Do not immediately modify code or SQL.

First build a complete understanding of:

```text
Database Schema
        ↓
Database Constraints
        ↓
RLS Policies
        ↓
RPC Functions
        ↓
Triggers
        ↓
Realtime
        ↓
Sync Protocol
        ↓
CRDT Layer
        ↓
Application Stores
        ↓
Offline Storage
        ↓
Bootstrap
        ↓
Incremental Sync
        ↓
Conflict Resolution
````

Changes made without understanding this dependency chain are unacceptable.

---

## Rule 2 — Never modify applied production migrations

Treat every migration already applied to production as immutable.

Never:

* rename an applied migration
* delete an applied migration
* modify an applied migration
* rewrite migration history without explicit justification

Any new database change must be introduced through a new forward migration.

Before creating a migration:

1. Run migration history inspection.
2. Confirm local and remote histories match.
3. Identify the latest applied migration.
4. Generate a new unique timestamp.
5. Ensure the new timestamp is chronologically after the latest applied migration.

Before pushing:

```bash
supabase migration list
supabase db push --dry-run
```

The dry run must show only the intended new migrations.

---

## Rule 3 — Never destroy production data

Do not perform destructive schema operations without a verified migration strategy.

For every potentially destructive change use:

```text
EXPAND
↓
BACKFILL
↓
VERIFY
↓
ENFORCE
↓
MIGRATE READERS
↓
MIGRATE WRITERS
↓
OBSERVE
↓
CONTRACT
```

Example:

Do NOT immediately change:

```sql
ALTER COLUMN user_id SET NOT NULL;
```

Instead:

1. Detect NULL rows.
2. Determine why they exist.
3. Backfill when ownership can be proven.
4. Quarantine records whose ownership cannot be proven.
5. Prevent new NULL writes.
6. Verify zero invalid records.
7. Add NOT NULL.
8. Add tests.

---

## Rule 4 — Never weaken security to fix functionality

Do not solve application errors by:

* disabling RLS
* adding unrestricted policies
* granting broad permissions
* using service-role keys in clients
* making SECURITY DEFINER functions unnecessarily
* bypassing tenant checks
* trusting client-provided user IDs

Every security-sensitive RPC must derive identity from:

```sql
auth.uid()
```

where appropriate.

Never trust:

```text
p_user_id
user_id from client payload
tenant_id from untrusted client
```

without server-side authorization validation.

---

# 3. Phase 1 — Complete Database Inventory

Inspect the entire repository.

Find and document:

```text
supabase/migrations/**
supabase/config.toml
database types
SQL files
RPC calls
Realtime subscriptions
authentication logic
OAuth handling
sync code
CRDT code
offline persistence
application stores
bootstrap logic
background synchronization
```

Produce:

```text
docs/database/SCHEMA_AUDIT.md
```

Document every table.

For each table record:

| Field                   | Required |
| ----------------------- | -------- |
| Table                   | Yes      |
| Purpose                 | Yes      |
| Primary key             | Yes      |
| Foreign keys            | Yes      |
| Unique constraints      | Yes      |
| Check constraints       | Yes      |
| Nullable columns        | Yes      |
| Default values          | Yes      |
| Indexes                 | Yes      |
| RLS enabled             | Yes      |
| RLS policies            | Yes      |
| Realtime enabled        | Yes      |
| Sync strategy           | Yes      |
| Retention strategy      | Yes      |
| Sensitive fields        | Yes      |
| Encryption requirements | Yes      |

Do not infer.

Verify against actual SQL.

---

# 4. Schema Rigor Audit

Audit every column.

Classify it as:

```text
REQUIRED
OPTIONAL
DERIVED
CACHED
LEGACY
DEPRECATED
SYNC_METADATA
SECURITY_SENSITIVE
```

Pay special attention to:

```text
user_id
title
created_at
updated_at
deleted_at
status
priority
provider
plan_tier
device_id
external_id
calendar_id
```

For every nullable column ask:

> Can a valid row exist without this value?

If no:

```sql
NOT NULL
```

should eventually be enforced.

Do not blindly add NOT NULL constraints.

Audit existing data first.

---

# 5. Domain Types and State Machines

Identify all columns containing constrained business states represented as arbitrary TEXT.

Examples may include:

```text
status
priority
provider
plan_tier
entity_type
sync_status
conflict_type
recurrence_type
```

Determine whether each should use:

1. PostgreSQL ENUM
2. CHECK constraint
3. Lookup/reference table
4. Domain type
5. Free-form text

Do not automatically use PostgreSQL ENUM for everything.

Evaluate schema evolution requirements.

For frequently evolving application states, prefer explicit CHECK constraints or reference tables when appropriate.

Example:

```sql
CHECK (
    status IN (
        'pending',
        'in_progress',
        'completed',
        'cancelled'
    )
)
```

Invalid states must not be accepted silently.

---

# 6. Referential Integrity

Build a complete entity relationship map.

Audit relationships involving:

```text
users
profiles
devices
notes
tasks
events
projects
folders
calendars
calendar_accounts
calendar_mappings
CRDT documents
CRDT updates
conflict logs
sync cursors
OAuth connections
```

For every relationship determine:

```text
Should a foreign key exist?
What should ON DELETE do?
What should ON UPDATE do?
Can orphan rows exist?
```

Possible policies:

```text
ON DELETE CASCADE
ON DELETE RESTRICT
ON DELETE SET NULL
```

Choose intentionally.

Never add CASCADE without analyzing blast radius.

Create queries that detect existing orphaned records before adding constraints.

---

# 7. Unique Constraints

Identify logical uniqueness guarantees.

Examples:

```text
user + device_id
user + provider + external_account_id
calendar + external_event_id
entity_type + entity_id + op_id
user + sync_cursor
email
```

Ensure duplicate records cannot be introduced by:

```text
concurrent requests
sync retries
offline replay
CRDT replay
OAuth reconnect
webhooks
```

Where appropriate use:

```sql
UNIQUE (...)
```

and idempotent:

```sql
INSERT ... ON CONFLICT
```

patterns.

---

# 8. Indexing Audit

Analyze all major query paths.

Inspect application code and RPCs.

For every important query document:

```text
table
filter
join
sort
pagination
expected cardinality
existing index
recommended index
```

Pay particular attention to:

```text
user_id
updated_seq_id
updated_at
deleted_at
entity_id
entity_type
op_id
calendar_id
external_id
provider
created_at
```

Audit composite indexes.

Example:

```sql
(user_id, updated_seq_id)
```

may be significantly more useful than independent indexes for incremental synchronization.

Use PostgreSQL query plans where possible:

```sql
EXPLAIN
EXPLAIN ANALYZE
```

Do not create speculative indexes without identifying the query they serve.

Also identify redundant and unused indexes.

---

# 9. Notes Content Model Audit

The assessment identified potentially overlapping note representations.

Investigate fields such as:

```text
body
content
plain_text
excerpt
CRDT snapshot
CRDT operation log
```

Determine the canonical source of truth.

Every representation must have exactly one documented role.

Example target architecture:

```text
Canonical collaborative state
        ↓
CRDT document/snapshot

Incremental collaboration
        ↓
CRDT operation log

Portable representation
        ↓
Markdown body

Search projection
        ↓
plain_text

UI preview
        ↓
excerpt
```

If this architecture is chosen, explicitly document:

```text
SOURCE OF TRUTH
DERIVED FIELD
CACHE
PROJECTION
SYNCED FIELD
```

No field should exist without a clear owner and lifecycle.

Prevent derived fields from becoming competing sources of truth.

---

# 10. CRDT Architecture Audit

Synq currently appears to use multiple synchronization mechanisms:

```text
CRDT
HLC timestamps
field_versions
updated_seq_id
conflict logs
```

Determine whether these mechanisms complement one another or compete.

Define exact responsibilities.

A possible model:

```text
CRDT
→ collaborative document content

HLC
→ ordering distributed metadata mutations

field_versions
→ field-level conflict detection

updated_seq_id
→ efficient incremental synchronization

conflict_log
→ observability/audit
```

But do not assume this is correct.

Validate against actual implementation.

Produce:

```text
docs/architecture/SYNC_PROTOCOL.md
```

The document must answer:

```text
What is authoritative?
What is eventually consistent?
What is strongly transactional?
What can conflict?
How are conflicts resolved?
How are conflicts observed?
How does offline replay work?
How does bootstrap work?
How does incremental sync work?
How does deletion propagate?
How are tombstones handled?
How are duplicate operations prevented?
How does a new device recover?
```

There must be one coherent synchronization architecture.

Not two overlapping systems accidentally solving the same problem.

---

# 11. Sequence Sync Correctness

Audit:

```text
updated_seq_id
user_sync_cursors
bootstrap RPCs
delta sync RPCs
```

Explicitly test:

```text
p_last_seq_id = 0
```

The first synchronization must correctly return all relevant records.

Test:

```text
new user
existing user
new device
offline device
long-offline device
multiple devices
deleted records
concurrent updates
```

Verify cursor advancement is atomic and cannot skip records.

Analyze the race:

```text
Client reads delta
        ↓
Concurrent mutation occurs
        ↓
Cursor advances
```

Prove that no update can disappear between those operations.

---

# 12. Device Architecture

Audit:

```text
active_device_ids
active_devices
devices table
device sessions
sync cursors
```

Determine whether multiple representations are redundant.

Choose one canonical device model.

Example:

```text
devices
├── id
├── user_id
├── device_id
├── platform
├── app_version
├── created_at
├── last_seen_at
└── revoked_at
```

Then reference it where necessary.

Do not maintain multiple independent representations of device state unless there is a documented reason.

---

# 13. Consistent Types

Find concepts represented with different PostgreSQL types.

Example:

```text
color TEXT
color INT4
```

Create a canonical representation.

Possible options:

```text
HEX string
semantic token
integer ARGB
```

Choose based on cross-platform compatibility between:

```text
Web
Flutter
PostgreSQL
APIs
```

The same concept must not have incompatible types across entities without justification.

---

# 14. Row Level Security Audit

Perform a full RLS audit.

Every user-owned table must answer:

```text
Can user A read user B's data?
Can user A update user B's data?
Can user A delete user B's data?
Can user A insert rows owned by user B?
```

Test every operation:

```text
SELECT
INSERT
UPDATE
DELETE
```

Do not assume RLS is correct because it is enabled.

Test policies explicitly.

Create automated adversarial tests:

```text
User A creates note
User B attempts SELECT
→ DENIED

User B attempts UPDATE
→ DENIED

User B attempts DELETE
→ DENIED

User B attempts INSERT with user_id = User A
→ DENIED
```

Repeat for every tenant-owned table.

---

# 15. SECURITY DEFINER Audit

Find every:

```sql
SECURITY DEFINER
```

function.

For each function verify:

1. Why SECURITY DEFINER is required.
2. search_path is explicitly restricted.
3. Caller authorization is checked.
4. Client-controlled ownership IDs cannot bypass auth.
5. Dynamic SQL is safe.
6. SQL injection is impossible.
7. Execute permissions are minimal.

Prefer:

```sql
auth.uid()
```

over trusting client-supplied ownership.

Remove SECURITY DEFINER when unnecessary.

---

# 16. OAuth Security

Audit storage of:

```text
access_token
refresh_token
IV
authentication tag
key_version
provider account IDs
```

Verify:

```text
tokens encrypted at rest
encryption occurs server-side
keys are never stored in database
keys are never shipped to clients
service-role key is never exposed
key rotation is supported
logs never contain tokens
errors never contain tokens
```

Define key rotation.

Example:

```text
key_version = 1
        ↓
decrypt using key v1
        ↓
encrypt using key v2
        ↓
update key_version
```

Document compromise response.

---

# 17. Data Minimization

Perform a field-by-field privacy audit.

For every stored field ask:

```text
Why do we store this?
Who reads it?
How long is it retained?
Can it be derived?
Can it remain client-side?
Does server-side functionality require it?
```

Classify:

```text
REQUIRED
OPTIONAL
DERIVED
CACHE
SENSITIVE
REMOVE
```

Do not copy Morgen's privacy architecture blindly.

Synq's offline-first and cross-device architecture may legitimately require server-side persistence.

The requirement is:

> Store the minimum data required to deliver Synq's chosen functionality.

Document those tradeoffs.

---

# 18. Deletion and Tombstones

Audit deletion semantics.

Define:

```text
soft delete
hard delete
tombstone
retention
CRDT deletion
sync propagation
```

Test:

```text
Device A deletes note
Device B is offline
Device B reconnects
```

The note must not resurrect.

Test:

```text
Device B edits stale deleted note
```

Define deterministic behavior.

Ensure tombstone compaction cannot cause resurrection on long-offline devices.

---

# 19. Migration Safety

Every new migration must pass:

```text
syntax validation
local application
fresh database application
existing database upgrade
rollback strategy analysis
data integrity validation
RLS validation
performance validation
```

Where rollback is unsafe, use forward-fix migrations.

Never pretend every migration is reversibly roll-backable.

For destructive transformations prefer:

```text
expand
migrate
verify
contract
```

---

# 20. Fresh Database Test

Prove that a developer can create the entire database from zero using Git-tracked migrations.

Test:

```text
empty database
↓
apply all migrations
↓
seed test users
↓
run integration tests
```

The result must match the expected current schema.

Migration history must be reproducible.

---

# 21. Upgrade Test

Test migration from a representative previous production schema.

Verify:

```text
no lost rows
no invalid foreign keys
no duplicate keys
no broken RPCs
no broken RLS
no broken Realtime
```

---

# 22. Sync Test Matrix

Create automated tests for:

```text
Initial bootstrap
Incremental sync
Offline mutation
Reconnect
Concurrent edits
Duplicate operation
Out-of-order operation
CRDT replay
CRDT snapshot bootstrap
Deleted entity
Stale client
Multiple devices
Multiple tabs
Network interruption
Retry
RPC timeout
Realtime disconnect
Realtime reconnect
```

Every scenario must define expected results.

---

# 23. Property-Based Sync Testing

Where practical generate randomized operation sequences:

```text
create
update
delete
offline
reconnect
conflicting update
duplicate update
```

Apply operations in different orders.

Verify convergence.

The invariant:

```text
After all operations are delivered,
all healthy clients converge to the same logical state.
```

---

# 24. Security Test Matrix

Automate tests for:

```text
cross-user reads
cross-user writes
cross-user deletes
forged user_id
forged device_id
expired authentication
revoked session
malformed RPC payload
SQL injection attempts
oversized payload
duplicate op_id
unauthorized CRDT update
unauthorized Realtime access
```

No critical security scenario may rely solely on manual testing.

---

# 25. Observability

Add structured observability for:

```text
sync bootstrap
delta sync
CRDT operations
RPC failures
conflicts
retries
rollback
cursor advancement
OAuth refresh
Realtime disconnects
```

Never log:

```text
OAuth tokens
authentication secrets
full private note content
encryption keys
service-role credentials
```

Metrics should include:

```text
sync latency
bootstrap latency
delta size
conflict rate
RPC failure rate
retry rate
CRDT compaction duration
Realtime reconnect rate
```

---

# 26. Performance

Establish realistic scale targets.

Test at minimum:

```text
10,000 notes
50,000 tasks
50,000 events
multiple calendars
large CRDT histories
multiple devices
```

Measure:

```text
bootstrap latency
delta sync latency
query latency
database CPU
index usage
payload size
```

Prevent unbounded queries.

Use pagination and bounded limits.

---

# 27. Backup and Disaster Recovery

Verify:

```text
database backups
point-in-time recovery availability
restore procedure
OAuth key backup/rotation strategy
CRDT recovery
migration recovery
```

Document:

```text
docs/runbooks/DATABASE_RECOVERY.md
```

A backup is not considered valid until restoration has been tested.

---

# 28. Required Deliverables

Produce:

```text
docs/database/SCHEMA_AUDIT.md

docs/database/SCHEMA_INVARIANTS.md

docs/architecture/SYNC_PROTOCOL.md

docs/security/RLS_AUDIT.md

docs/security/OAUTH_SECURITY.md

docs/privacy/DATA_MINIMIZATION.md

docs/runbooks/DATABASE_RECOVERY.md

docs/testing/SYNC_TEST_MATRIX.md

docs/testing/SECURITY_TEST_MATRIX.md
```

All documentation must reflect the implemented system, not aspirational architecture.

---

# 29. Implementation Process

Execute work in this order:

```text
1. Inventory
2. Audit
3. Risk classification
4. Architecture decisions
5. Tests reproducing current failures
6. Forward-only migrations
7. Application compatibility changes
8. Backfills
9. Constraints
10. RLS hardening
11. RPC hardening
12. Sync hardening
13. CRDT validation
14. Security testing
15. Performance testing
16. Migration testing
17. Documentation
18. Final verification
```

Do not mix unrelated architectural changes into one giant migration.

Use small, reviewable migrations with clear purposes.

---

# 30. Severity Classification

Classify findings:

```text
P0 — Active data loss or security vulnerability

P1 — Serious integrity/sync/security risk

P2 — Production reliability problem

P3 — Structural/maintainability issue

P4 — Optimization
```

Fix in priority order.

No P0 or P1 issue may remain unresolved at release.

---

# 31. No Hidden Backlog Rule

Do not finish the task by writing:

```text
TODO
FIXME
later
future improvement
out of scope
should eventually
```

for a correctness or security problem.

If a discovered issue cannot safely be fixed immediately:

1. Clearly identify the blocker.
2. Explain why immediate modification would be unsafe.
3. Add a failing/guardrail test where possible.
4. Define the exact remediation.
5. Prevent release if the issue is P0/P1.

Do not silently ignore findings.

This does NOT mean making unsafe changes just to claim zero backlog.

Safety and correctness take priority.

---

# 32. No Test Debt Rule

Every fixed bug must have a regression test.

Every critical invariant must have an automated test.

Every RLS policy must have authorization tests.

Every critical RPC must have:

```text
success test
authentication test
authorization test
invalid-input test
idempotency test where applicable
```

Sync must have:

```text
bootstrap test
incremental test
offline test
conflict test
deletion test
recovery test
```

A feature is not complete when implementation passes.

It is complete when the implementation and its invariants are protected by tests.

---

# 33. Definition of 10/10

Do not declare the system "10/10" based on subjective comparison.

The system may receive a 10/10 only if all measurable gates pass.

## Schema Rigor

* Core required fields use NOT NULL.
* Domain states are constrained.
* Types are consistent.
* No unexplained duplicate representations.

## Integrity

* Foreign keys protect required relationships.
* Unique constraints protect logical identities.
* Orphan detection passes.
* Duplicate detection passes.

## Security

* RLS covers all tenant-owned tables.
* Cross-user access tests pass.
* SECURITY DEFINER audit passes.
* Secrets never reach clients/logs.
* OAuth encryption and rotation are documented and tested.

## Sync

* Initial bootstrap passes.
* Incremental sync passes.
* Multi-device convergence passes.
* Offline replay passes.
* Duplicate operation handling passes.
* Tombstone/deletion tests pass.
* Cursor race analysis passes.

## CRDT

* CRDT responsibility is explicit.
* Snapshot/bootstrap works.
* Operation replay is idempotent.
* Compaction cannot cause data loss.
* CRDT and metadata conflict systems have non-overlapping responsibilities.

## Migrations

* Local and remote history match.
* Fresh database builds successfully.
* Production upgrade path passes.
* No applied migration has been mutated.
* `db push --dry-run` contains only intended migrations.

## Performance

* Critical queries have justified indexes.
* No known unbounded hot-path queries.
* Scale tests meet defined targets.

## Reliability

* Backup strategy exists.
* Restore procedure is tested.
* Sync failures are observable.
* Critical operations have recovery behavior.

## Testing

* All critical paths have automated tests.
* Regression tests exist for discovered bugs.
* Security matrix passes.
* Sync matrix passes.
* CI is green.

Only after every applicable gate passes may the audit report:

```text
Synq Production Readiness Score: 10/10
```

If any gate fails, report the actual score and exact failing criteria.

Never inflate the score.

---

# 34. Final Verification

Before declaring completion, run the complete verification suite.

At minimum verify:

```text
Type checking
Linting
Unit tests
Integration tests
Database tests
RLS tests
RPC tests
Sync tests
CRDT tests
Migration tests
Fresh database test
Upgrade test
Security tests
Production build
```

Then verify Supabase migration state:

```bash
supabase migration list
supabase db push --dry-run
```

Expected final result:

```text
Local migration history = Remote migration history

Remote database is up to date.
```

If a new migration intentionally awaits deployment, document exactly which migration and why.

---

# 35. Final Report

At completion produce:

# Synq Database Production Readiness Report

Include:

```text
Original Score
Final Score

P0 Issues Found / Fixed / Remaining
P1 Issues Found / Fixed / Remaining
P2 Issues Found / Fixed / Remaining
P3 Issues Found / Fixed / Remaining

Schema Rigor Score
Data Modeling Score
Privacy Score
Sync Architecture Score
Security Score
Referential Integrity Score
Migration Safety Score
Testing Score
Performance Score
Observability Score
Disaster Recovery Score
```

For every original criticism provide:

```text
Finding
Evidence
Root Cause
Decision
Implementation
Migration
Tests
Verification
Final Status
```

Use statuses:

```text
VERIFIED FIXED
VERIFIED NOT AN ISSUE
BLOCKED — RELEASE BLOCKER
```

Never mark something fixed solely because code was written.

It must be verified.

---

# 36. Critical Final Instruction

Do not optimize Synq to imitate Google, Notion, or Morgen.

Optimize Synq for Synq's actual requirements:

```text
Offline-first
Local-first
Cross-device
Web + Flutter
Collaborative editing
CRDT content
Structured tasks/events
Calendar synchronization
Bidirectional external calendar sync
Reliable multi-device synchronization
Strong tenant isolation
Privacy-conscious architecture
Production-grade reliability
```

The desired architecture is:

```text
STRICT WHERE STRICTNESS PROTECTS DATA

FLEXIBLE WHERE PRODUCT EVOLUTION REQUIRES FLEXIBILITY

LOCAL-FIRST WHERE LOCAL OWNERSHIP IMPROVES UX

SERVER-AUTHORITATIVE WHERE SECURITY REQUIRES IT

CRDT-BASED WHERE CONCURRENT COLLABORATION REQUIRES IT

TRANSACTIONAL WHERE INTEGRITY REQUIRES IT

EVENTUALLY CONSISTENT WHERE DISTRIBUTED SYSTEMS REQUIRE IT

OBSERVABLE EVERYWHERE
```

Do not sacrifice correctness for architectural elegance.

Do not sacrifice security for convenience.

Do not sacrifice data integrity for backward compatibility.

Do not sacrifice offline reliability for simpler server architecture.

Do not introduce complexity without proving why it is necessary.

Audit first.

Prove every claim.

Implement incrementally.

Use forward-only migrations.

Protect every invariant with tests.

Verify every security boundary.

Measure performance.

Document architectural decisions.

The task is complete only when the implemented system, migrations, tests, security controls, and documentation all agree on how Synq works.

```

For your particular Synq codebase, I would have the agent pay **extra attention to three areas first**: the coexistence of Yjs/CRDT operations with `HLC + field_versions + updated_seq_id`, the distinction between `notes.body` and CRDT state so you never repeat the content-loss incident you had between Flutter and Web, and the new `p_last_seq_id = 0` bootstrap fix you are currently preparing. Those three areas are directly connected to the most dangerous class of bug for Synq: **silent cross-device data loss**.

I would also make the agent treat the migration you just created—`20260719000000_fix_initial_sequence_sync.sql`—as part of this audit and require a regression test proving that a brand-new device starting at sequence `0` receives all expected notes, tasks, events, projects, and folders before that migration goes to production.
```
