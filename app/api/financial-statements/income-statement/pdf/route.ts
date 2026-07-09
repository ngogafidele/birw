// Streams the income statement as a PDF (admin/manager only).
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireManagerOrAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { STORE_DOCUMENT_DETAILS } from "@/lib/utils/constants"
import { resolveIncomeRange } from "@/lib/financial/period"
import { computeIncomeStatement } from "@/lib/financial/income-statement"
import { generateIncomeStatementPDF } from "@/lib/pdf/financial-statement-generator"

export const runtime = "nodejs"

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

    const pdf = await generateIncomeStatementPDF(
      {
        range: { from: range.fromInput, to: range.toInput },
        generatedAt: new Date(),
        statement,
      },
      STORE_DOCUMENT_DETAILS[store]
    )

    const filename = `income-statement-${range.fromInput}-to-${range.toInput}.pdf`
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Income Statement PDF Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate income statement PDF" },
      { status: 500 }
    )
  }
}
