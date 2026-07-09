// Lists resolved manual balance sheet items and creates new ones (admin/manager only).
import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectToDatabase } from "@/lib/db/connection"
import { requireManagerOrAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { BalanceSheetItem } from "@/lib/db/models/BalanceSheetItem"
import { CreateBalanceSheetItemSchema } from "@/lib/db/validators/balance-sheet-item"
import { resolveManualItems } from "@/lib/financial/balance-sheet"
import { resolveAsOf } from "@/lib/financial/period"
import { parseBusinessDateInput } from "@/lib/utils/time"

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
    const { endExclusive } = resolveAsOf(searchParams.get("asOf") ?? undefined)

    await connectToDatabase()
    const items = await resolveManualItems(store, endExclusive)

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    console.error("[Balance Sheet Items Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to load balance sheet items" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const payload = CreateBalanceSheetItemSchema.parse(await request.json())
    const effectiveDate = parseBusinessDateInput(payload.effectiveDate)
    if (!effectiveDate) {
      return NextResponse.json(
        { success: false, error: "Invalid effective date" },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const groupId = new mongoose.Types.ObjectId()
    await BalanceSheetItem.create({
      store,
      groupId,
      category: payload.category,
      name: payload.name.trim(),
      amount: payload.amount,
      effectiveDate,
      status: "active",
      notes: payload.notes?.trim() ?? "",
      createdBy: session.userId,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          groupId: groupId.toString(),
          category: payload.category,
          name: payload.name.trim(),
          amount: payload.amount,
          effectiveDate: payload.effectiveDate,
          notes: payload.notes?.trim() ?? "",
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create balance sheet item"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
