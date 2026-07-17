import { supabase } from "@/shared"

export interface DeltaSyncPayload {
  notes?: any[]
  tasks?: any[]
  events?: any[]
  projects?: any[]
  folders?: any[]
  latest_seq_id?: number
  sync_timestamp?: string
}

interface DeltaSyncResult {
  data: DeltaSyncPayload | null
  error: unknown | null
}

type DeltaSyncSignature = "seqWithLimit" | "seqOnly" | "legacyTimestamp"

let workingSignature: DeltaSyncSignature | null = null

export function serializeSyncError(error: unknown): Record<string, unknown> {
  if (!error) return { message: "Unknown sync error" }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>
    const serialized: Record<string, unknown> = {}

    for (const key of ["code", "message", "details", "hint", "status", "statusText"]) {
      if (record[key] !== undefined) {
        serialized[key] = record[key]
      }
    }

    return Object.keys(serialized).length > 0 ? serialized : { error }
  }

  return { message: String(error) }
}

function isMissingRpcSignature(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { code?: unknown }).code === "PGRST202"
  )
}

async function callDeltaSync(
  signature: DeltaSyncSignature,
  lastSeqId: number,
  limit: number
): Promise<DeltaSyncResult> {
  const args = signature === "seqWithLimit"
    ? { p_last_seq_id: lastSeqId, p_limit: limit }
    : signature === "seqOnly"
      ? { p_last_seq_id: lastSeqId }
      : { p_last_sync_at: null }

  const result = await supabase.rpc("get_delta_sync", args)
  return {
    data: result.data as DeltaSyncPayload | null,
    error: result.error,
  }
}

export async function fetchDeltaSync(lastSeqId: number, limit = 1000): Promise<DeltaSyncResult> {
  const signatures: DeltaSyncSignature[] = workingSignature
    ? [workingSignature]
    : ["seqWithLimit", "seqOnly", "legacyTimestamp"]

  let lastSignatureError: unknown = null

  for (const signature of signatures) {
    const result = await callDeltaSync(signature, lastSeqId, limit)

    if (!result.error) {
      workingSignature = signature
      return result
    }

    lastSignatureError = result.error
    if (!isMissingRpcSignature(result.error)) {
      return result
    }
  }

  if (workingSignature) {
    workingSignature = null
    return fetchDeltaSync(lastSeqId, limit)
  }

  return { data: null, error: lastSignatureError }
}
