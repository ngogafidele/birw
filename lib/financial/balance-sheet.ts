// Computes the balance sheet as of a date: reconstructed auto lines plus manual items.
//
// Auto lines are reconstructed to the as-of date (no live point-in-time snapshot exists):
//   - Inventory Value: each product's quantity is rewound from its current level by removing
//     stock movements dated after the as-of date (receipts, sales, returns, replacements,
//     adjustments), matching the reconstruction in app/api/products/[id]/movements. On-hand
//     units are valued at the latest receipt unitCost on/before the date, falling back to the
//     latest sale cost snapshot, then the product's current costPrice.
//   - Accounts Receivable: for each loan sale created on/before the date, totalAmount minus
//     payments received on/before the date (floored at zero).
//   - Retained Earnings: cumulative net profit through the date (the income statement formula).
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { ReturnModel } from "@/lib/db/models/Return"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { BalanceSheetItem } from "@/lib/db/models/BalanceSheetItem"
import type { StoreKey } from "@/lib/auth/session"
import { computeIncomeStatement } from "@/lib/financial/income-statement"

export type BalanceSheetCategory =
  | "current_asset"
  | "fixed_asset"
  | "current_liability"
  | "long_term_liability"
  | "equity"

export type BalanceSheetLine = {
  label: string
  amount: number
  source: "auto" | "manual"
  id?: string
  note?: string
}

export type BalanceSheet = {
  asOf: string
  assets: {
    current: BalanceSheetLine[]
    fixed: BalanceSheetLine[]
    total: number
  }
  liabilities: {
    current: BalanceSheetLine[]
    longTerm: BalanceSheetLine[]
    total: number
  }
  equity: { lines: BalanceSheetLine[]; total: number }
  totalAssets: number
  totalLiabilitiesAndEquity: number
  // Positive => assets exceed liabilities + equity; shown plainly rather than forced to zero.
  balanceDifference: number
}

// Manual lines grouped by category, resolved from the versioned item history.
export type ManualLinesByCategory = Record<BalanceSheetCategory, BalanceSheetLine[]>

// A manual item resolved to the single version in effect on the as-of date.
export type ResolvedManualItem = {
  groupId: string
  category: BalanceSheetCategory
  name: string
  amount: number
  effectiveDate: string
  notes: string
}

function emptyManual(): ManualLinesByCategory {
  return {
    current_asset: [],
    fixed_asset: [],
    current_liability: [],
    long_term_liability: [],
    equity: [],
  }
}

type ManualVersionRow = {
  category: BalanceSheetCategory
  name: string
  amount: number
  effectiveDate: Date
  status: "active" | "deleted"
  notes?: string
}

// Resolves each item group to the latest version effective on/before the as-of cutoff,
// dropping any group whose latest effective version is a delete tombstone.
export async function resolveManualItems(
  store: StoreKey,
  endExclusive: Date
): Promise<ResolvedManualItem[]> {
  const rows = await BalanceSheetItem.aggregate<{
    _id: unknown
    doc: ManualVersionRow
  }>([
    { $match: { store, effectiveDate: { $lt: endExclusive } } },
    { $sort: { effectiveDate: 1, createdAt: 1 } },
    { $group: { _id: "$groupId", doc: { $last: "$$ROOT" } } },
    { $match: { "doc.status": "active" } },
  ])

  return rows.map((row) => ({
    groupId: String(row._id),
    category: row.doc.category,
    name: row.doc.name,
    amount: row.doc.amount,
    effectiveDate: new Date(row.doc.effectiveDate).toISOString().slice(0, 10),
    notes: row.doc.notes ?? "",
  }))
}

export function manualItemsToLines(
  items: ResolvedManualItem[]
): ManualLinesByCategory {
  const grouped = emptyManual()
  for (const item of items) {
    grouped[item.category].push({
      label: item.name,
      amount: item.amount,
      source: "manual",
      id: item.groupId,
      note: item.notes || undefined,
    })
  }
  return grouped
}

type ProductRow = { _id: unknown; quantity: number; costPrice: number }
type IdQtyAgg = { _id: unknown; qty: number }
type IdCostAgg = { _id: unknown; unitCost: number }

function keyOf(id: unknown) {
  return String(id)
}

// Reconstructs total inventory value at the as-of cutoff (movements dated >= endExclusive
// are "after" the snapshot and are rewound out of the current quantity).
async function computeInventoryValue(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const [
    products,
    receiptsAfter,
    salesAfter,
    returnsInAfter,
    replacementsOutAfter,
    adjustmentsAfter,
    latestReceiptCost,
    latestSaleCost,
  ] = await Promise.all([
    Product.find({ store }).select("_id quantity costPrice").lean<ProductRow[]>(),
    // Receipts after the date came IN after the snapshot -> subtract.
    ProductReceipt.aggregate<IdQtyAgg>([
      { $match: { store, receivedAt: { $gte: endExclusive } } },
      { $group: { _id: "$productId", qty: { $sum: "$quantity" } } },
    ]),
    // Sales after the date went OUT after the snapshot -> add back.
    Sale.aggregate<IdQtyAgg>([
      { $match: { store, createdAt: { $gte: endExclusive } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.quantity" } } },
    ]),
    // Returned goods came IN after the snapshot -> subtract.
    ReturnModel.aggregate<IdQtyAgg>([
      { $match: { store, createdAt: { $gte: endExclusive } } },
      { $unwind: "$returnItems" },
      {
        $group: { _id: "$returnItems.productId", qty: { $sum: "$returnItems.quantity" } },
      },
    ]),
    // Replacements issued went OUT after the snapshot -> add back.
    ReturnModel.aggregate<IdQtyAgg>([
      { $match: { store, createdAt: { $gte: endExclusive } } },
      { $unwind: "$replacementItems" },
      {
        $group: {
          _id: "$replacementItems.productId",
          qty: { $sum: "$replacementItems.quantity" },
        },
      },
    ]),
    // Adjustments after the date (signed) -> subtract their net change.
    StockAdjustment.aggregate<IdQtyAgg>([
      { $match: { store, createdAt: { $gte: endExclusive } } },
      { $group: { _id: "$productId", qty: { $sum: "$quantityChange" } } },
    ]),
    // Latest receipt unit cost on/before the date.
    ProductReceipt.aggregate<IdCostAgg>([
      { $match: { store, receivedAt: { $lt: endExclusive } } },
      { $sort: { receivedAt: 1, createdAt: 1 } },
      { $group: { _id: "$productId", unitCost: { $last: "$unitCost" } } },
    ]),
    // Fallback: latest sale cost snapshot on/before the date.
    Sale.aggregate<IdCostAgg>([
      { $match: { store, createdAt: { $lt: endExclusive } } },
      { $unwind: "$items" },
      { $sort: { createdAt: 1 } },
      { $group: { _id: "$items.productId", unitCost: { $last: "$items.basePrice" } } },
    ]),
  ])

  const receiptsAfterMap = new Map(receiptsAfter.map((r) => [keyOf(r._id), r.qty]))
  const salesAfterMap = new Map(salesAfter.map((r) => [keyOf(r._id), r.qty]))
  const returnsInMap = new Map(returnsInAfter.map((r) => [keyOf(r._id), r.qty]))
  const replacementsOutMap = new Map(
    replacementsOutAfter.map((r) => [keyOf(r._id), r.qty])
  )
  const adjustmentsMap = new Map(adjustmentsAfter.map((r) => [keyOf(r._id), r.qty]))
  const receiptCostMap = new Map(
    latestReceiptCost.map((r) => [keyOf(r._id), r.unitCost])
  )
  const saleCostMap = new Map(latestSaleCost.map((r) => [keyOf(r._id), r.unitCost]))

  let total = 0
  for (const product of products) {
    const id = keyOf(product._id)
    const inAfter =
      (receiptsAfterMap.get(id) ?? 0) + (returnsInMap.get(id) ?? 0)
    const outAfter =
      (salesAfterMap.get(id) ?? 0) + (replacementsOutMap.get(id) ?? 0)
    const netAfter = inAfter - outAfter + (adjustmentsMap.get(id) ?? 0)
    const quantityAtDate = product.quantity - netAfter
    if (quantityAtDate <= 0) continue

    const unitCost =
      receiptCostMap.get(id) ?? saleCostMap.get(id) ?? product.costPrice ?? 0
    total += quantityAtDate * unitCost
  }

  return total
}

type ArAgg = { ar: number }

// Sums outstanding loan balances as of the date from payment history.
async function computeAccountsReceivable(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const result = await Sale.aggregate<ArAgg>([
    {
      $match: {
        store,
        outstanding: { $ne: null },
        createdAt: { $lt: endExclusive },
      },
    },
    {
      $addFields: {
        paidAsOf: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ["$payments", []] },
                  as: "p",
                  cond: { $lt: ["$$p.paidAt", endExclusive] },
                },
              },
              as: "p",
              in: "$$p.amount",
            },
          },
        },
      },
    },
    {
      $addFields: {
        balance: { $max: [0, { $subtract: ["$totalAmount", "$paidAsOf"] }] },
      },
    },
    { $group: { _id: null, ar: { $sum: "$balance" } } },
  ])

  return result[0]?.ar ?? 0
}

function sumLines(lines: BalanceSheetLine[]) {
  return lines.reduce((total, line) => total + line.amount, 0)
}

export type BalanceSheetInput = {
  asOf: Date
  endExclusive: Date
  asOfInput: string
  // Optional override; when omitted, manual items are resolved from the versioned history.
  manual?: ManualLinesByCategory
}

export async function computeBalanceSheet(
  store: StoreKey,
  { endExclusive, asOfInput, manual }: BalanceSheetInput
): Promise<BalanceSheet> {
  const [inventoryValue, accountsReceivable, income, resolvedManual] =
    await Promise.all([
      computeInventoryValue(store, endExclusive),
      computeAccountsReceivable(store, endExclusive),
      computeIncomeStatement(store, { endExclusive }),
      manual
        ? Promise.resolve(manual)
        : resolveManualItems(store, endExclusive).then(manualItemsToLines),
    ])

  const currentAssets: BalanceSheetLine[] = [
    {
      label: "Inventory Value",
      amount: inventoryValue,
      source: "auto",
      note: "Reconstructed on-hand stock valued at latest receipt cost",
    },
    {
      label: "Accounts Receivable",
      amount: accountsReceivable,
      source: "auto",
      note: "Outstanding loan balances as of date",
    },
    ...resolvedManual.current_asset,
  ]
  const fixedAssets = [...resolvedManual.fixed_asset]

  const currentLiabilities = [...resolvedManual.current_liability]
  const longTermLiabilities = [...resolvedManual.long_term_liability]

  const equityLines: BalanceSheetLine[] = [
    {
      label: "Retained Earnings",
      amount: income.netProfit,
      source: "auto",
      note: "Cumulative net profit through date",
    },
    ...resolvedManual.equity,
  ]

  const assetsTotal = sumLines(currentAssets) + sumLines(fixedAssets)
  const liabilitiesTotal =
    sumLines(currentLiabilities) + sumLines(longTermLiabilities)
  const equityTotal = sumLines(equityLines)
  const totalLiabilitiesAndEquity = liabilitiesTotal + equityTotal

  return {
    asOf: asOfInput,
    assets: {
      current: currentAssets,
      fixed: fixedAssets,
      total: assetsTotal,
    },
    liabilities: {
      current: currentLiabilities,
      longTerm: longTermLiabilities,
      total: liabilitiesTotal,
    },
    equity: { lines: equityLines, total: equityTotal },
    totalAssets: assetsTotal,
    totalLiabilitiesAndEquity,
    balanceDifference: assetsTotal - totalLiabilitiesAndEquity,
  }
}
