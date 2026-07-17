// Resolves immutable sale snapshots for historical financial statements.
import { Sale } from "@/lib/db/models/Sale"
import { SaleSnapshot } from "@/lib/db/models/SaleSnapshot"
import type { StoreKey } from "@/lib/auth/session"

export type SnapshotLineItem = {
  productId: unknown
  quantity: number
  basePrice: number
  lineTotal: number
}

type SnapshotPayment = {
  amount?: number
  paidAt?: Date
}

type SnapshotRow = {
  saleId: unknown
  effectiveAt: Date
  createdAt: Date
  reason: "created" | "edited" | "payment" | "settled" | "deleted"
  items: SnapshotLineItem[]
  totalAmount: number
  paymentStatus?: "paid" | "unpaid"
  outstanding?: unknown
  payments?: SnapshotPayment[]
}

export type ResolvedSaleSnapshot = SnapshotRow & {
  saleCreatedAt: Date
}

export type SaleFinancialTotals = {
  revenue: number
  grossProfit: number
}

type LiveSaleRow = {
  _id: unknown
  createdAt: Date
  items: SnapshotLineItem[]
  totalAmount: number
  paymentStatus?: "paid" | "unpaid"
  outstanding?: unknown
  payments?: SnapshotPayment[]
}

type SaleSnapshotEvent = SnapshotRow

function keyOf(id: unknown) {
  return String(id)
}

function inPeriod(date: Date, from: Date | undefined, endExclusive: Date) {
  return (!from || date >= from) && date < endExclusive
}

function sumItems(items: SnapshotLineItem[] | undefined) {
  const totals = new Map<string, number>()
  for (const item of items ?? []) {
    const productId = keyOf(item.productId)
    totals.set(productId, (totals.get(productId) ?? 0) + item.quantity)
  }
  return totals
}

function applyItemDelta(
  target: Map<string, number>,
  previous: SnapshotLineItem[] | undefined,
  next: SnapshotLineItem[] | undefined
) {
  const previousTotals = sumItems(previous)
  const nextTotals = sumItems(next)
  const productIds = new Set([...previousTotals.keys(), ...nextTotals.keys()])

  for (const productId of productIds) {
    const delta = (nextTotals.get(productId) ?? 0) - (previousTotals.get(productId) ?? 0)
    if (delta !== 0) {
      target.set(productId, (target.get(productId) ?? 0) + delta)
    }
  }
}

function saleTotalsFromItems(items: SnapshotLineItem[]) {
  return items.reduce(
    (total, item) => {
      total.revenue += item.lineTotal
      total.grossProfit += item.lineTotal - item.basePrice * item.quantity
      return total
    },
    { revenue: 0, grossProfit: 0 }
  )
}

async function snapshotSaleIds(store: StoreKey) {
  return SaleSnapshot.distinct("saleId", { store })
}

export async function computeSnapshotAwareSaleTotals(
  store: StoreKey,
  from: Date | undefined,
  endExclusive: Date
): Promise<SaleFinancialTotals> {
  const [resolvedSnapshots, saleIdsWithSnapshots] = await Promise.all([
    resolveSaleSnapshotsAsOf(store, endExclusive),
    snapshotSaleIds(store),
  ])

  const snapshotTotals = resolvedSnapshots.reduce<SaleFinancialTotals>(
    (total, sale) => {
      if (!inPeriod(sale.saleCreatedAt, from, endExclusive)) return total
      const saleTotals = saleTotalsFromItems(sale.items)
      total.revenue += saleTotals.revenue
      total.grossProfit += saleTotals.grossProfit
      return total
    },
    { revenue: 0, grossProfit: 0 }
  )

  const liveSales = await Sale.find({
    store,
    createdAt: from ? { $gte: from, $lt: endExclusive } : { $lt: endExclusive },
    ...(saleIdsWithSnapshots.length > 0 ? { _id: { $nin: saleIdsWithSnapshots } } : {}),
  })
    .select("items")
    .lean<Array<{ items: SnapshotLineItem[] }>>()

  return liveSales.reduce<SaleFinancialTotals>((total, sale) => {
    const saleTotals = saleTotalsFromItems(sale.items)
    total.revenue += saleTotals.revenue
    total.grossProfit += saleTotals.grossProfit
    return total
  }, snapshotTotals)
}

export async function resolveSaleSnapshotsAsOf(
  store: StoreKey,
  endExclusive: Date
): Promise<ResolvedSaleSnapshot[]> {
  const rows = await SaleSnapshot.find({ store, effectiveAt: { $lt: endExclusive } })
    .sort({ saleId: 1, effectiveAt: 1, createdAt: 1 })
    .lean<SnapshotRow[]>()

  const bySale = new Map<string, { createdAt: Date; latest: SnapshotRow }>()
  for (const row of rows) {
    const saleId = keyOf(row.saleId)
    const existing = bySale.get(saleId)
    const createdAt =
      row.reason === "created"
        ? new Date(row.effectiveAt)
        : existing?.createdAt ?? new Date(row.effectiveAt)
    bySale.set(saleId, { createdAt, latest: row })
  }

  return Array.from(bySale.values())
    .filter(({ latest }) => latest.reason !== "deleted")
    .map(({ createdAt, latest }) => ({
      ...latest,
      saleCreatedAt: createdAt,
    }))
}

export async function computeSnapshotAwareSalesOutAfter(
  store: StoreKey,
  endExclusive: Date
): Promise<Map<string, number>> {
  const [snapshotRows, saleIdsWithSnapshots] = await Promise.all([
    SaleSnapshot.find({ store })
      .sort({ saleId: 1, effectiveAt: 1, createdAt: 1 })
      .lean<SaleSnapshotEvent[]>(),
    snapshotSaleIds(store),
  ])

  const outAfter = new Map<string, number>()
  let currentSaleId = ""
  let previousItems: SnapshotLineItem[] = []

  for (const row of snapshotRows) {
    const saleId = keyOf(row.saleId)
    if (saleId !== currentSaleId) {
      currentSaleId = saleId
      previousItems = []
    }

    const nextItems = row.reason === "deleted" ? [] : row.items
    if (row.effectiveAt >= endExclusive) {
      applyItemDelta(outAfter, previousItems, nextItems)
    }
    previousItems = nextItems
  }

  const liveSales = await Sale.find({
    store,
    createdAt: { $gte: endExclusive },
    ...(saleIdsWithSnapshots.length > 0 ? { _id: { $nin: saleIdsWithSnapshots } } : {}),
  })
    .select("items")
    .lean<Array<{ items: SnapshotLineItem[] }>>()

  for (const sale of liveSales) {
    applyItemDelta(outAfter, [], sale.items)
  }

  return outAfter
}

export async function latestSnapshotAwareSaleCosts(
  store: StoreKey,
  endExclusive: Date
): Promise<Map<string, number>> {
  const [resolvedSnapshots, saleIdsWithSnapshots] = await Promise.all([
    resolveSaleSnapshotsAsOf(store, endExclusive),
    snapshotSaleIds(store),
  ])
  const costs = new Map<string, number>()

  for (const sale of resolvedSnapshots.sort(
    (a, b) => a.saleCreatedAt.getTime() - b.saleCreatedAt.getTime()
  )) {
    for (const item of sale.items) {
      costs.set(keyOf(item.productId), item.basePrice)
    }
  }

  const liveSales = await Sale.find({
    store,
    createdAt: { $lt: endExclusive },
    ...(saleIdsWithSnapshots.length > 0 ? { _id: { $nin: saleIdsWithSnapshots } } : {}),
  })
    .sort({ createdAt: 1 })
    .select("items")
    .lean<Array<{ items: SnapshotLineItem[] }>>()

  for (const sale of liveSales) {
    for (const item of sale.items) {
      costs.set(keyOf(item.productId), item.basePrice)
    }
  }

  return costs
}

function collectedFromSale(
  sale: {
    totalAmount: number
    paymentStatus?: "paid" | "unpaid"
    payments?: SnapshotPayment[]
  },
  endExclusive: Date
) {
  const payments = sale.payments ?? []
  if (payments.length === 0) {
    // Plain paid sales collect their full amount at creation. Loans settled before
    // the snapshot ledger existed carry no dated settlement payment, so their
    // collection is approximated at the sale's own date (known gap).
    return sale.paymentStatus === "paid" ? sale.totalAmount : 0
  }
  return payments.reduce((paid, payment) => {
    if (!payment.paidAt || payment.paidAt >= endExclusive) return paid
    return paid + (payment.amount ?? 0)
  }, 0)
}

// Sums customer money actually collected on/before the date: paid sales at
// creation plus dated loan installments received before the date.
export async function computeSnapshotAwareCashCollected(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const [resolvedSnapshots, saleIdsWithSnapshots] = await Promise.all([
    resolveSaleSnapshotsAsOf(store, endExclusive),
    snapshotSaleIds(store),
  ])

  let total = 0
  for (const sale of resolvedSnapshots) {
    if (sale.saleCreatedAt >= endExclusive) continue
    total += collectedFromSale(sale, endExclusive)
  }

  const liveSales = await Sale.find({
    store,
    createdAt: { $lt: endExclusive },
    ...(saleIdsWithSnapshots.length > 0 ? { _id: { $nin: saleIdsWithSnapshots } } : {}),
  })
    .select("totalAmount paymentStatus payments")
    .lean<
      Array<{
        totalAmount: number
        paymentStatus?: "paid" | "unpaid"
        payments?: SnapshotPayment[]
      }>
    >()

  for (const sale of liveSales) {
    total += collectedFromSale(sale, endExclusive)
  }

  return total
}

export async function computeSnapshotAwareAccountsReceivable(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const [resolvedSnapshots, saleIdsWithSnapshots] = await Promise.all([
    resolveSaleSnapshotsAsOf(store, endExclusive),
    snapshotSaleIds(store),
  ])

  let total = 0
  for (const sale of resolvedSnapshots) {
    if (sale.saleCreatedAt >= endExclusive) continue
    const isReceivable = Boolean(sale.outstanding) || (sale.payments?.length ?? 0) > 0
    if (!isReceivable) continue

    const paidAsOf = (sale.payments ?? []).reduce((paid, payment) => {
      if (!payment.paidAt || payment.paidAt >= endExclusive) return paid
      return paid + (payment.amount ?? 0)
    }, 0)
    total += Math.max(0, sale.totalAmount - paidAsOf)
  }

  const liveSales = await Sale.find({
    store,
    createdAt: { $lt: endExclusive },
    $or: [{ outstanding: { $ne: null } }, { "payments.0": { $exists: true } }],
    ...(saleIdsWithSnapshots.length > 0 ? { _id: { $nin: saleIdsWithSnapshots } } : {}),
  })
    .select("totalAmount outstanding payments")
    .lean<LiveSaleRow[]>()

  for (const sale of liveSales) {
    const paidAsOf = (sale.payments ?? []).reduce((paid, payment) => {
      if (!payment.paidAt || payment.paidAt >= endExclusive) return paid
      return paid + (payment.amount ?? 0)
    }, 0)
    total += Math.max(0, sale.totalAmount - paidAsOf)
  }

  return total
}
