// Computes the income statement from sales, returns, and expenses.
//
// This intentionally replicates the exact revenue/COGS/profit math used by the Reports
// page (app/(dashboard)/reports/page.tsx) so the two surfaces always agree:
//   - Revenue is net of returns (returns are contra-revenue).
//   - Gross profit nets returned-goods cost out of COGS (returns reduce COGS too).
//   - COGS is derived as Revenue - Gross Profit.
//   - Sales/returns are dated by createdAt; expenses by their `date` field.
// If the Reports formula ever changes, update this module in lockstep.
import { Sale } from "@/lib/db/models/Sale"
import { ReturnModel } from "@/lib/db/models/Return"
import { Expense } from "@/lib/db/models/Expense"
import type { StoreKey } from "@/lib/auth/session"

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

type SaleAgg = { revenue: number; grossProfit: number }
type ReturnAgg = { revenue: number; grossProfit: number }
type ExpenseAgg = { expenses: number }

function dateFilter(from: Date | undefined, endExclusive: Date) {
  return from ? { $gte: from, $lt: endExclusive } : { $lt: endExclusive }
}

export async function computeIncomeStatement(
  store: StoreKey,
  { from, endExclusive }: IncomeStatementPeriod
): Promise<IncomeStatement> {
  const createdAt = dateFilter(from, endExclusive)
  const expenseDate = dateFilter(from, endExclusive)

  const [saleTotals, returnTotals, expenseTotals] = await Promise.all([
    Sale.aggregate<SaleAgg>([
      { $match: { store, createdAt } },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.lineTotal" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$items.lineTotal",
                { $multiply: ["$items.basePrice", "$items.quantity"] },
              ],
            },
          },
        },
      },
    ]),
    ReturnModel.aggregate<ReturnAgg>([
      { $match: { store, createdAt } },
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
    ]),
    Expense.aggregate<ExpenseAgg>([
      { $match: { store, date: expenseDate } },
      { $group: { _id: null, expenses: { $sum: "$amount" } } },
    ]),
  ])

  const salesRevenue = saleTotals[0]?.revenue ?? 0
  const salesGrossProfit = saleTotals[0]?.grossProfit ?? 0
  const returnsRevenue = returnTotals[0]?.revenue ?? 0
  const returnsGrossProfit = returnTotals[0]?.grossProfit ?? 0

  const revenue = salesRevenue - returnsRevenue
  const grossProfit = salesGrossProfit - returnsGrossProfit
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
