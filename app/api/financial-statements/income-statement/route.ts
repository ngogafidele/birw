// Returns the computed income statement for a date range (admin/manager only).
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireManagerOrAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { resolveIncomeRange } from "@/lib/financial/period"
import { computeIncomeStatement } from "@/lib/financial/income-statement"

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
    const range = resolveIncomeRange(
      searchParams.get("start") ?? undefined,
      searchParams.get("end") ?? undefined
    )

    await connectToDatabase()
    const statement = await computeIncomeStatement(store, {
      from: range.from,
      endExclusive: range.endExclusive,
    })

    return NextResponse.json({
      success: true,
      data: {
        statement,
        range: { from: range.fromInput, to: range.toInput },
      },
    })
  } catch (error) {
    console.error("[Income Statement Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to compute income statement" },
      { status: 500 }
    )
  }
}
