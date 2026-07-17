// Computes the income statement from sales, returns, and expenses.
//
// Formula parity: this replicates the exact revenue/COGS/profit math used by the
// Reports page (app/(dashboard)/reports/page.tsx):
//   - Revenue is net of returns (returns are contra-revenue).
//   - Gross profit nets returned-goods cost out of COGS (returns reduce COGS too).
//   - COGS is derived as Revenue - Gross Profit.
//   - Sales/returns are dated by createdAt; expenses by their `date` field.
// If the Reports formula ever changes, update this module in lockstep.
//
// Data-source divergence (intentional): Reports read LIVE sales/returns so an
// admin correcting an old record sees the correction reflected everywhere in the
// operational dashboards. Financial statements read the immutable snapshot ledger
// (sale-snapshot-reporting / return-snapshot-reporting) so an issued statement for
// a past date stays stable even after later corrections. Same formulas, different
// source of record — do not "fix" one to match the other without deciding which
// behavior is wanted.
import { Expense } from "@/lib/db/models/Expense"
import type { StoreKey } from "@/lib/auth/session"
import { computeSnapshotAwareSaleTotals } from "@/lib/financial/sale-snapshot-reporting"
import { computeSnapshotAwareReturnTotals } from "@/lib/financial/return-snapshot-reporting"

export type IncomeStatement = {
  revenue: number
  costOfGoodsSold: number
  grossProfit: number
  operatingExpenses: number
  netProfit: number
}

export type IncomeStatementPeriod = {
  // Omit `from` for a cumulative statement (e.g. retained earnings from the earliest record).
  from?: Date
  endExclusive: Date
}

type ExpenseAgg = { expenses: number }

function dateFilter(from: Date | undefined, endExclusive: Date) {
  return from ? { $gte: from, $lt: endExclusive } : { $lt: endExclusive }
}

export async function computeIncomeStatement(
  store: StoreKey,
  { from, endExclusive }: IncomeStatementPeriod
): Promise<IncomeStatement> {
  const expenseDate = dateFilter(from, endExclusive)

  const [saleTotals, returnTotals, expenseTotals] = await Promise.all([
    computeSnapshotAwareSaleTotals(store, from, endExclusive),
    computeSnapshotAwareReturnTotals(store, from, endExclusive),
    Expense.aggregate<ExpenseAgg>([
      { $match: { store, date: expenseDate } },
      { $group: { _id: null, expenses: { $sum: "$amount" } } },
    ]),
  ])

  const revenue = saleTotals.revenue - returnTotals.revenue
  const grossProfit = saleTotals.grossProfit - returnTotals.grossProfit
  const costOfGoodsSold = revenue - grossProfit
  const operatingExpenses = expenseTotals[0]?.expenses ?? 0
  const netProfit = grossProfit - operatingExpenses

  return {
    revenue,
    costOfGoodsSold,
    grossProfit,
    operatingExpenses,
    netProfit,
  }
}
