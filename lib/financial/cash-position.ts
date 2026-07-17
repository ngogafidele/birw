// Derives the Cash & Bank position as of a date from recorded money flows.
//
//   In:  customer collections — paid sales at their sale date, loan installments
//        at their dated paidAt (snapshot-aware, so later edits don't shift history).
//   Out: supplier purchases (product receipts), operating expenses, and net
//        customer refunds (returned value minus replacement goods issued).
//
// Purchases and expenses carry no split between cash/bank/mobile that spans every
// flow (receipts have no payment method), so this is a single combined figure.
// Owner capital injections and drawings are not tracked operationally — record
// them as manual balance sheet items; until then this derived figure can be
// negative and the balance check surfaces the gap.
import { Expense } from "@/lib/db/models/Expense"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import type { StoreKey } from "@/lib/auth/session"
import { computeSnapshotAwareCashCollected } from "@/lib/financial/sale-snapshot-reporting"
import { computeSnapshotAwareNetRefunds } from "@/lib/financial/return-snapshot-reporting"

type SumAgg = { total: number }

export async function computeCashPosition(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const [collected, netRefunds, expenseAgg, purchaseAgg] = await Promise.all([
    computeSnapshotAwareCashCollected(store, endExclusive),
    computeSnapshotAwareNetRefunds(store, endExclusive),
    Expense.aggregate<SumAgg>([
      { $match: { store, date: { $lt: endExclusive } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ProductReceipt.aggregate<SumAgg>([
      { $match: { store, receivedAt: { $lt: endExclusive } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$unitCost", "$quantity"] } },
        },
      },
    ]),
  ])

  return (
    collected -
    netRefunds -
    (expenseAgg[0]?.total ?? 0) -
    (purchaseAgg[0]?.total ?? 0)
  )
}
