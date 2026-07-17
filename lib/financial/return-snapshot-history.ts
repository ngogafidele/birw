// Helpers for recording immutable return versions used by financial statement snapshots.
import type { ClientSession } from "mongoose"
import { ReturnSnapshot } from "@/lib/db/models/ReturnSnapshot"

type ReturnSnapshotReason = "created" | "edited" | "deleted"

// Mongoose documents surface unset optional paths as `null`, so every optional
// field here tolerates null and is normalized in toSnapshot.
type SnapshotReturn = {
  _id: unknown
  store: string
  returnItems: unknown[]
  replacementItems?: unknown[] | null
  totalReturnAmount: number
  totalReplacementAmount?: number | null
  createdAt?: Date | null
  createdBy: unknown
}

function toSnapshot(
  returnDoc: SnapshotReturn,
  effectiveAt: Date,
  reason: ReturnSnapshotReason
) {
  return {
    store: returnDoc.store,
    returnId: returnDoc._id,
    effectiveAt,
    reason,
    returnItems: returnDoc.returnItems,
    replacementItems: returnDoc.replacementItems ?? [],
    totalReturnAmount: returnDoc.totalReturnAmount,
    totalReplacementAmount: returnDoc.totalReplacementAmount ?? 0,
    createdBy: returnDoc.createdBy,
  }
}

export async function recordReturnSnapshot(
  returnDoc: SnapshotReturn,
  reason: ReturnSnapshotReason,
  effectiveAt: Date,
  session?: ClientSession
) {
  await ReturnSnapshot.create([toSnapshot(returnDoc, effectiveAt, reason)], {
    session,
  })
}

export async function ensureInitialReturnSnapshot(
  returnDoc: SnapshotReturn,
  session?: ClientSession
) {
  const existing = await ReturnSnapshot.exists({
    store: returnDoc.store,
    returnId: returnDoc._id,
  }).session(session ?? null)

  if (existing) return

  await recordReturnSnapshot(
    returnDoc,
    "created",
    returnDoc.createdAt ? new Date(returnDoc.createdAt) : new Date(),
    session
  )
}
