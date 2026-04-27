/**
 * Per-Field LWW-Register CRDT
 * 
 * Each field on a record has its own HLC timestamp.
 * Merge is commutative, associative, and idempotent — true CRDT semantics.
 * Used for structured data: Tasks, Projects, Events.
 */

import { HLC } from '@/lib/hlc'

export interface FieldVersion {
  value: unknown
  timestamp: string   // HLC string
  clientId: string    // originating client
}

export type FieldVersionMap = Record<string, string>

/**
 * Compare two HLC timestamps with deterministic tie-breaking.
 * If timestamps are equal, the higher clientId wins (lexicographic).
 * Returns > 0 if a wins, < 0 if b wins, 0 if identical.
 */
export function compareWithTieBreak(
  aTimestamp: string,
  aClientId: string,
  bTimestamp: string,
  bClientId: string
): number {
  const hlcCmp = HLC.compare(aTimestamp, bTimestamp)
  if (hlcCmp !== 0) return hlcCmp
  // Deterministic tie-break: higher client ID wins
  return aClientId.localeCompare(bClientId)
}

/**
 * Merge two sets of field versions, returning the winning value for each field.
 * This is the core CRDT merge function.
 * 
 * @param local  - The local record's current state
 * @param remote - The incoming remote record
 * @param localFieldVersions  - Per-field HLC timestamps from local
 * @param remoteFieldVersions - Per-field HLC timestamps from remote
 * @param localClientId  - Local client identifier
 * @param remoteClientId - Remote client identifier (from nodeId in HLC)
 * @param skipFields - Fields to skip during merge (e.g. 'id', 'user_id', 'created_at')
 * @returns Merged record with combined field versions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeFields<T extends Record<string, any>>(
  local: T,
  remote: T,
  localFieldVersions: FieldVersionMap,
  remoteFieldVersions: FieldVersionMap,
  localClientId: string,
  remoteClientId: string,
  skipFields: string[] = ['id', 'user_id', 'created_at', 'field_versions', 'hlc_timestamp']
): { merged: T; mergedVersions: FieldVersionMap } {
  const merged = { ...local } as T
  const mergedVersions = { ...localFieldVersions }

  for (const key of Object.keys(remote)) {
    if (skipFields.includes(key)) continue
    if (remote[key] === undefined) continue

    const remoteV = remoteFieldVersions[key]
    const localV = localFieldVersions[key]

    // If remote has a field version and local doesn't, remote wins
    if (remoteV && !localV) {
      ;(merged as Record<string, unknown>)[key] = remote[key]
      mergedVersions[key] = remoteV
      continue
    }

    // If both have versions, compare them
    if (remoteV && localV) {
      const cmp = compareWithTieBreak(remoteV, remoteClientId, localV, localClientId)
      if (cmp > 0) {
        // Remote wins
        ;(merged as Record<string, unknown>)[key] = remote[key]
        mergedVersions[key] = remoteV
      }
      // else local wins — keep local value
      continue
    }

    // If neither has a version (legacy data), fall back to record-level HLC
    const remoteHlc = remote['hlc_timestamp'] as string | undefined
    const localHlc = local['hlc_timestamp'] as string | undefined
    if (remoteHlc && localHlc && HLC.compare(remoteHlc, localHlc) > 0) {
      ;(merged as Record<string, unknown>)[key] = remote[key]
      if (remoteHlc) mergedVersions[key] = remoteHlc
    }
  }

  return { merged, mergedVersions }
}

/**
 * Build field_versions for a set of updated fields, all sharing the same HLC timestamp.
 */
export function stampFields(
  existingVersions: FieldVersionMap,
  updatedKeys: string[],
  timestamp: string
): FieldVersionMap {
  const versions = { ...existingVersions }
  for (const key of updatedKeys) {
    versions[key] = timestamp
  }
  // Always stamp updated_at
  versions['updated_at'] = timestamp
  return versions
}
