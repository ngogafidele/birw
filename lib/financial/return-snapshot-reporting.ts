// Resolves immutable return snapshots for historical financial statements.
//
// Mirrors lib/financial/sale-snapshot-reporting.ts: returns recorded before the
// snapshot ledger existed have no snapshots and are read live; once a return is
// snapshotted, its snapshot history is authoritative for as-of reporting.
import { ReturnModel } from "@/lib/db/models/Return"
import { ReturnSnapshot } from "@/lib/db/models/ReturnSnapshot"
import type { StoreKey } from "@/lib/auth/session"

export type ReturnLineItem = {
  productId: unknown
  quantity: number
  basePrice?: number
  lineTotal: number
}

type ReturnSnapshotRow = {
  returnId: unknown
  effectiveAt: Date
  createdAt: Date
  reason: "created" | "edited" | "deleted"
  returnItems: ReturnLineItem[]
  replacementItems: ReturnLineItem[]
  totalReturnAmount: number
  totalReplacementAmount?: number
}

export type ResolvedReturnSnapshot = ReturnSnapshotRow & {
  returnCreatedAt: Date
}

export type ReturnFinancialTotals = {
  revenue: number
  grossProfit: number
}

type LiveReturnAgg = { revenue: number; grossProfit: number }

function keyOf(id: unknown) {
  return String(id)
}

function inPeriod(date: Date, from: Date | undefined, endExclusive: Date) {
  return (!from || date >= from) && date < endExclusive
}

function sumItems(items: ReturnLineItem[] | undefined) {
  const totals = new Map<string, number>()
  for (const item of items ?? []) {
    const productId = keyOf(item.productId)
    totals.set(productId, (totals.get(productId) ?? 0) + item.quantity)
  }
  return totals
}

function applyItemDelta(
  target: Map<string, number>,
  previous: ReturnLineItem[] | undefined,
  next: ReturnLineItem[] | undefined
) {
  const previousTotals = sumItems(previous)
  const nextTotals = sumItems(next)
  const productIds = new Set([...previousTotals.keys(), ...nextTotals.keys()])

  for (const productId of productIds) {
    const delta =
      (nextTotals.get(productId) ?? 0) - (previousTotals.get(productId) ?? 0)
    if (delta !== 0) {
      target.set(productId, (target.get(productId) ?? 0) + delta)
    }
  }
}

async function snapshotReturnIds(store: StoreKey) {
  return ReturnSnapshot.distinct("returnId", { store })
}

export async function resolveReturnSnapshotsAsOf(
  store: StoreKey,
  endExclusive: Date
): Promise<ResolvedReturnSnapshot[]> {
  const rows = await ReturnSnapshot.find({
    store,
    effectiveAt: { $lt: endExclusive },
  })
    .sort({ returnId: 1, effectiveAt: 1, createdAt: 1 })
    .lean<ReturnSnapshotRow[]>()

  const byReturn = new Map<string, { createdAt: Date; latest: ReturnSnapshotRow }>()
  for (const row of rows) {
    const returnId = keyOf(row.returnId)
    const existing = byReturn.get(returnId)
    const createdAt =
      row.reason === "created"
        ? new Date(row.effectiveAt)
        : existing?.createdAt ?? new Date(row.effectiveAt)
    byReturn.set(returnId, { createdAt, latest: row })
  }

  return Array.from(byReturn.values())
    .filter(({ latest }) => latest.reason !== "deleted")
    .map(({ createdAt, latest }) => ({
      ...latest,
      returnCreatedAt: createdAt,
    }))
}

function returnTotalsFromItems(items: ReturnLineItem[]) {
  return items.reduce(
    (total, item) => {
      total.revenue += item.lineTotal
      total.grossProfit += item.lineTotal - (item.basePrice ?? 0) * item.quantity
      return total
    },
    { revenue: 0, grossProfit: 0 }
  )
}

// Matches the Reports/income-statement return math: revenue is the returned line
// totals; gross profit is line totals minus returned-goods cost.
export async function computeSnapshotAwareReturnTotals(
  store: StoreKey,
  from: Date | undefined,
  endExclusive: Date
): Promise<ReturnFinancialTotals> {
  const [resolvedSnapshots, returnIdsWithSnapshots] = await Promise.all([
    resolveReturnSnapshotsAsOf(store, endExclusive),
    snapshotReturnIds(store),
  ])

  const totals = resolvedSnapshots.reduce<ReturnFinancialTotals>(
    (total, row) => {
      if (!inPeriod(row.returnCreatedAt, from, endExclusive)) return total
      const rowTotals = returnTotalsFromItems(row.returnItems)
      total.revenue += rowTotals.revenue
      total.grossProfit += rowTotals.grossProfit
      return total
    },
    { revenue: 0, grossProfit: 0 }
  )

  // Live (never-snapshotted) returns keep the legacy cost fallback: rows recorded
  // before basePrice existed fall back to the product's current costPrice.
  const liveTotals = await ReturnModel.aggregate<LiveReturnAgg>([
    {
      $match: {
        store,
        createdAt: from
          ? { $gte: from, $lt: endExclusive }
          : { $lt: endExclusive },
        ...(returnIdsWithSnapshots.length > 0
          ? { _id: { $nin: returnIdsWithSnapshots } }
          : {}),
      },
    },
    { $unwind: "$returnItems" },
    {
      $lookup: {
        from: "products",
        localField: "returnItems.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$returnItems.lineTotal" },
        grossProfit: {
          $sum: {
            $subtract: [
              "$returnItems.lineTotal",
              {
                $multiply: [
                  {
                    $ifNull: [
                      "$returnItems.basePrice",
                      { $ifNull: ["$product.costPrice", 0] },
                    ],
                  },
                  "$returnItems.quantity",
                ],
              },
            ],
          },
        },
      },
    },
  ])

  return {
    revenue: totals.revenue + (liveTotals[0]?.revenue ?? 0),
    grossProfit: totals.grossProfit + (liveTotals[0]?.grossProfit ?? 0),
  }
}

// Sums money handed back to customers on/before the date: returned value minus
// the value of replacement goods issued in exchange.
export async function computeSnapshotAwareNetRefunds(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const [resolvedSnapshots, returnIdsWithSnapshots] = await Promise.all([
    resolveReturnSnapshotsAsOf(store, endExclusive),
    snapshotReturnIds(store),
  ])

  let total = 0
  for (const row of resolvedSnapshots) {
    if (row.returnCreatedAt >= endExclusive) continue
    total += row.totalReturnAmount - (row.totalReplacementAmount ?? 0)
  }

  const liveReturns = await ReturnModel.find({
    store,
    createdAt: { $lt: endExclusive },
    ...(returnIdsWithSnapshots.length > 0
      ? { _id: { $nin: returnIdsWithSnapshots } }
      : {}),
  })
    .select("totalReturnAmount totalReplacementAmount")
    .lean<
      Array<{ totalReturnAmount: number; totalReplacementAmount?: number }>
    >()

  for (const row of liveReturns) {
    total += row.totalReturnAmount - (row.totalReplacementAmount ?? 0)
  }

  return total
}

export type ReturnFlowsAfter = {
  // Returned goods that came IN after the as-of date (rewound out of current stock).
  returnsInAfter: Map<string, number>
  // Replacement goods that went OUT after the as-of date (rewound back into stock).
  replacementsOutAfter: Map<string, number>
}

// Replays snapshot deltas dated on/after the cutoff so edited or deleted returns
// still rewind inventory to its true historical level.
export async function computeSnapshotAwareReturnFlowsAfter(
  store: StoreKey,
  endExclusive: Date
): Promise<ReturnFlowsAfter> {
  const [snapshotRows, returnIdsWithSnapshots] = await Promise.all([
    ReturnSnapshot.find({ store })
      .sort({ returnId: 1, effectiveAt: 1, createdAt: 1 })
      .lean<ReturnSnapshotRow[]>(),
    snapshotReturnIds(store),
  ])

  const returnsInAfter = new Map<string, number>()
  const replacementsOutAfter = new Map<string, number>()
  let currentReturnId = ""
  let previousReturnItems: ReturnLineItem[] = []
  let previousReplacementItems: ReturnLineItem[] = []

  for (const row of snapshotRows) {
    const returnId = keyOf(row.returnId)
    if (returnId !== currentReturnId) {
      currentReturnId = returnId
      previousReturnItems = []
      previousReplacementItems = []
    }

    const nextReturnItems = row.reason === "deleted" ? [] : row.returnItems
    const nextReplacementItems =
      row.reason === "deleted" ? [] : row.replacementItems ?? []
    if (row.effectiveAt >= endExclusive) {
      applyItemDelta(returnsInAfter, previousReturnItems, nextReturnItems)
      applyItemDelta(
        replacementsOutAfter,
        previousReplacementItems,
        nextReplacementItems
      )
    }
    previousReturnItems = nextReturnItems
    previousReplacementItems = nextReplacementItems
  }

  const liveReturns = await ReturnModel.find({
    store,
    createdAt: { $gte: endExclusive },
    ...(returnIdsWithSnapshots.length > 0
      ? { _id: { $nin: returnIdsWithSnapshots } }
      : {}),
  })
    .select("returnItems replacementItems")
    .lean<
      Array<{ returnItems: ReturnLineItem[]; replacementItems?: ReturnLineItem[] }>
    >()

  for (const row of liveReturns) {
    applyItemDelta(returnsInAfter, [], row.returnItems)
    applyItemDelta(replacementsOutAfter, [], row.replacementItems ?? [])
  }

  return { returnsInAfter, replacementsOutAfter }
}
