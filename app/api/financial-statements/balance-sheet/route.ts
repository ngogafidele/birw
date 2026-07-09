// Returns the computed balance sheet as of a date (admin/manager only).
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireManagerOrAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { resolveAsOf } from "@/lib/financial/period"
import { computeBalanceSheet } from "@/lib/financial/balance-sheet"

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireManagerOrAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: session ? "Access denied" : "Unauthorized" },
        { status: session ? 403 : 401 }
      )
    }

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const { asOf, endExclusive, asOfInput } = resolveAsOf(
      searchParams.get("asOf") ?? undefined
    )

    await connectToDatabase()
    const balanceSheet = await computeBalanceSheet(store, {
      asOf,
      endExclusive,
      asOfInput,
    })

    return NextResponse.json({ success: true, data: balanceSheet })
  } catch (error) {
    console.error("[Balance Sheet Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to compute balance sheet" },
      { status: 500 }
    )
  }
}
