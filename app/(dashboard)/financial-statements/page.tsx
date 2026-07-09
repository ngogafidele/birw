// Gates the financial statements workspace to admins and managers only.
import { redirect } from "next/navigation"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { STORE_LABELS } from "@/lib/utils/constants"
import { FinancialStatementsManager } from "@/components/financial-statements/financial-statements-manager"

export default async function FinancialStatementsPage() {
  const session = await requireServerSession()
  // Staff must not reach the financial statements surface.
  if (!session.isAdmin && session.role !== "manager") {
    redirect("/sales")
  }

  const store = getCurrentStore(session)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {STORE_LABELS[store]} Accounting
        </p>
        <h2 className="text-2xl font-semibold">Financial Statements</h2>
        <p className="text-sm text-muted-foreground">
          Income statement and balance sheet for {STORE_LABELS[store]}.
        </p>
      </div>

      <FinancialStatementsManager />
    </div>
  )
}
