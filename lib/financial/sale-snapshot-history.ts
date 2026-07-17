// Helpers for recording immutable sale versions used by balance-sheet snapshots.
import type { ClientSession } from "mongoose"
import { SaleSnapshot } from "@/lib/db/models/SaleSnapshot"

type SnapshotReason = "created" | "edited" | "payment" | "settled" | "deleted"

// Mongoose documents surface unset optional paths as `null`, so every optional
// field here tolerates null and is normalized in toSnapshot.
type SnapshotSale = {
  _id: unknown
  store: string
  items: unknown[]
  totalAmount: number
  paymentStatus?: "paid" | "unpaid" | null
  paymentMethod?: "cash" | "bank" | "mobile" | null
  customer?: unknown
  outstanding?: unknown
  payments?: unknown[] | null
  amountPaid?: number | null
  remainingBalance?: number | null
  createdAt?: Date | null
  createdBy: unknown
}

function toSnapshot(sale: SnapshotSale, effectiveAt: Date, reason: SnapshotReason) {
  return {
    store: sale.store,
    saleId: sale._id,
    effectiveAt,
    reason,
    items: sale.items,
    totalAmount: sale.totalAmount,
    paymentStatus: sale.paymentStatus ?? "paid",
    paymentMethod: sale.paymentMethod ?? undefined,
    customer: sale.customer ?? undefined,
    outstanding: sale.outstanding ?? undefined,
    payments: sale.payments ?? [],
    amountPaid: sale.amountPaid ?? 0,
    remainingBalance: sale.remainingBalance ?? 0,
    createdBy: sale.createdBy,
  }
}

export async function recordSaleSnapshot(
  sale: SnapshotSale,
  reason: SnapshotReason,
  effectiveAt: Date,
  session?: ClientSession
) {
  await SaleSnapshot.create([toSnapshot(sale, effectiveAt, reason)], { session })
}

export async function ensureInitialSaleSnapshot(
  sale: SnapshotSale,
  session?: ClientSession
) {
  const existing = await SaleSnapshot.exists({
    store: sale.store,
    saleId: sale._id,
  }).session(session ?? null)

  if (existing) return

  await recordSaleSnapshot(
    sale,
    "created",
    sale.createdAt ? new Date(sale.createdAt) : new Date(),
    session
  )
}
