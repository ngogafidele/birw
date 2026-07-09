// Streams the balance sheet as a PDF (admin/manager only).
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireManagerOrAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { STORE_DOCUMENT_DETAILS } from "@/lib/utils/constants"
import { resolveAsOf } from "@/lib/financial/period"
import { computeBalanceSheet } from "@/lib/financial/balance-sheet"
import { generateBalanceSheetPDF } from "@/lib/pdf/financial-statement-generator"

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
    const { asOf, endExclusive, asOfInput } = resolveAsOf(
      searchParams.get("asOf") ?? undefined
    )

    await connectToDatabase()
    const sheet = await computeBalanceSheet(store, { asOf, endExclusive, asOfInput })

    const pdf = await generateBalanceSheetPDF(
      { asOf: asOfInput, generatedAt: new Date(), sheet },
      STORE_DOCUMENT_DETAILS[store]
    )

    const filename = `balance-sheet-${asOfInput}.pdf`
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Balance Sheet PDF Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate balance sheet PDF" },
      { status: 500 }
    )
  }
}
