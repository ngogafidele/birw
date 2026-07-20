// Computes the balance sheet as of a date: reconstructed auto lines plus manual items.
//
// Auto lines are reconstructed to the as-of date (no live point-in-time snapshot exists):
//   - Cash & Bank: derived from recorded money flows (collections minus purchases,
//     expenses, and net refunds) — see lib/financial/cash-position.ts.
//   - Inventory Value: each product's quantity is rewound from its current level by removing
//     stock movements dated after the as-of date (receipts, sales, returns, replacements,
//     adjustments), matching the reconstruction in app/api/products/[id]/movements. Sale and
//     return movements replay the immutable snapshot ledger so later edits/deletes cannot
//     shift history. On-hand units are valued at the weighted-average purchase cost of
//     receipts on/before the date, falling back to the latest sale cost snapshot, then the
//     product's current costPrice.
//   - Accounts Receivable: outstanding loan balances rewound from dated payment history
//     (snapshot-aware).
//   - Equity: Retained Earnings (net profit through the prior year-end) plus Current Year
//     Earnings (net profit for the as-of year to date), both via the income statement formula.
import { Product } from "@/lib/db/models/Product"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { BalanceSheetItem } from "@/lib/db/models/BalanceSheetItem"
import type { StoreKey } from "@/lib/auth/session"
import { computeIncomeStatement } from "@/lib/financial/income-statement"
import { computeCashPosition } from "@/lib/financial/cash-position"
import {
  computeSnapshotAwareAccountsReceivable,
  computeSnapshotAwareSalesOutAfter,
  latestSnapshotAwareSaleCosts,
} from "@/lib/financial/sale-snapshot-reporting"
import { computeSnapshotAwareReturnFlowsAfter } from "@/lib/financial/return-snapshot-reporting"
import { parseBusinessDateInput } from "@/lib/utils/time"

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
  // Product names whose reconstructed as-of quantity went negative — a sign the
  // movement history is inconsistent; the value is floored at zero for those.
  inventoryWarnings: string[]
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

type ProductRow = { _id: unknown; name: string; quantity: number; costPrice: number }
type IdQtyAgg = { _id: unknown; qty: number }
type IdWacAgg = { _id: unknown; totalQty: number; totalCost: number }

function keyOf(id: unknown) {
  return String(id)
}

type InventoryValuation = {
  total: number
  // Products whose reconstructed quantity went negative (inconsistent history).
  negativeStockProducts: string[]
}

// Reconstructs total inventory value at the as-of cutoff (movements dated >= endExclusive
// are "after" the snapshot and are rewound out of the current quantity).
async function computeInventoryValue(
  store: StoreKey,
  endExclusive: Date
): Promise<InventoryValuation> {
  const [
    products,
    receiptsAfter,
    salesOutAfterMap,
    returnFlowsAfter,
    adjustmentsAfter,
    receiptWac,
    saleCostMap,
  ] = await Promise.all([
    Product.find({ store })
      .select("_id name quantity costPrice")
      .lean<ProductRow[]>(),
    // Receipts after the date came IN after the snapshot -> subtract.
    ProductReceipt.aggregate<IdQtyAgg>([
      { $match: { store, receivedAt: { $gte: endExclusive } } },
      { $group: { _id: "$productId", qty: { $sum: "$quantity" } } },
    ]),
    // Sale snapshot deltas after the date went OUT after the snapshot -> add back.
    computeSnapshotAwareSalesOutAfter(store, endExclusive),
    // Return snapshot deltas after the date: returned goods came IN -> subtract;
    // replacements issued went OUT -> add back.
    computeSnapshotAwareReturnFlowsAfter(store, endExclusive),
    // Adjustments after the date (signed) -> subtract their net change.
    StockAdjustment.aggregate<IdQtyAgg>([
      { $match: { store, createdAt: { $gte: endExclusive } } },
      { $group: { _id: "$productId", qty: { $sum: "$quantityChange" } } },
    ]),
    // Weighted-average purchase cost across all receipts on/before the date.
    ProductReceipt.aggregate<IdWacAgg>([
      { $match: { store, receivedAt: { $lt: endExclusive } } },
      {
        $group: {
          _id: "$productId",
          totalQty: { $sum: "$quantity" },
          totalCost: { $sum: { $multiply: ["$unitCost", "$quantity"] } },
        },
      },
    ]),
    latestSnapshotAwareSaleCosts(store, endExclusive),
  ])

  const receiptsAfterMap = new Map(receiptsAfter.map((r) => [keyOf(r._id), r.qty]))
  const returnsInMap = returnFlowsAfter.returnsInAfter
  const replacementsOutMap = returnFlowsAfter.replacementsOutAfter
  const adjustmentsMap = new Map(adjustmentsAfter.map((r) => [keyOf(r._id), r.qty]))
  const receiptCostMap = new Map(
    receiptWac
      .filter((r) => r.totalQty > 0)
      .map((r) => [keyOf(r._id), r.totalCost / r.totalQty])
  )

  let total = 0
  const negativeStockProducts: string[] = []
  for (const product of products) {
    const id = keyOf(product._id)
    const inAfter =
      (receiptsAfterMap.get(id) ?? 0) + (returnsInMap.get(id) ?? 0)
    const outAfter =
      (salesOutAfterMap.get(id) ?? 0) + (replacementsOutMap.get(id) ?? 0)
    const netAfter = inAfter - outAfter + (adjustmentsMap.get(id) ?? 0)
    const quantityAtDate = product.quantity - netAfter
    if (quantityAtDate < 0) {
      // Inconsistent movement history — surface it instead of silently skipping.
      negativeStockProducts.push(product.name)
      continue
    }
    if (quantityAtDate === 0) continue

    const unitCost =
      receiptCostMap.get(id) ?? saleCostMap.get(id) ?? product.costPrice ?? 0
    total += quantityAtDate * unitCost
  }

  return { total, negativeStockProducts }
}

// Sums outstanding loan balances as of the date from the snapshot ledger.
//
// A sale is a receivable candidate when its as-of snapshot is still an open loan
// (`outstanding` present) OR has recorded at least one dated installment payment — the
// balance is rewound from those dated payments, so a loan collected after the as-of date
// still shows its historical balance. Every settlement path (installments and the admin
// "mark paid in full" PATCH) now records a dated payment, so new settlements always
// reconstruct. Known gap: loans settled before the snapshot ledger existed carry no dated
// payment and are omitted for as-of dates preceding their (unknown) settlement.
async function computeAccountsReceivable(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  return computeSnapshotAwareAccountsReceivable(store, endExclusive)
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
  // Fiscal year = calendar year in business time; split equity into prior-year
  // retained earnings and current-year earnings at the year boundary.
  const asOfYear = Number(asOfInput.slice(0, 4))
  const yearStart = Number.isFinite(asOfYear)
    ? parseBusinessDateInput(`${asOfInput.slice(0, 4)}-01-01`)
    : null

  const [
    inventory,
    accountsReceivable,
    cashPosition,
    retainedIncome,
    currentYearIncome,
    resolvedManual,
  ] = await Promise.all([
    computeInventoryValue(store, endExclusive),
    computeAccountsReceivable(store, endExclusive),
    computeCashPosition(store, endExclusive),
    // Net profit through the prior year-end (cumulative when the split is unavailable).
    computeIncomeStatement(store, {
      endExclusive: yearStart ?? endExclusive,
    }),
    // Net profit for the as-of year to date (null yearStart folds into retained).
    yearStart
      ? computeIncomeStatement(store, { from: yearStart, endExclusive })
      : Promise.resolve(null),
    manual
      ? Promise.resolve(manual)
      : resolveManualItems(store, endExclusive).then(manualItemsToLines),
  ])

  const currentAssets: BalanceSheetLine[] = [
    {
      label: "Cash & Bank",
      amount: cashPosition,
      source: "auto",
      note: "Collections minus purchases, expenses, and refunds; record owner capital as manual items",
    },
    {
      label: "Inventory",
      amount: inventory.total,
      source: "auto",
      note: "Reconstructed on-hand stock at weighted-average purchase cost",
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
      amount: retainedIncome.netProfit,
      source: "auto",
      note: yearStart
        ? `Net profit through ${asOfYear - 1}-12-31`
        : "Cumulative net profit through date",
    },
    ...(currentYearIncome
      ? [
          {
            label: "Current Year Earnings",
            amount: currentYearIncome.netProfit,
            source: "auto" as const,
            note: `Net profit for ${asOfYear} through date`,
          },
        ]
      : []),
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
    inventoryWarnings: inventory.negativeStockProducts,
  }
}
