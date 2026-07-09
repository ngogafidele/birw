// Edits or deletes a manual balance sheet item by appending a new version (admin/manager only).
// The [id] segment is the item's stable groupId shared across all its versions.
import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectToDatabase } from "@/lib/db/connection"
import { requireManagerOrAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { BalanceSheetItem } from "@/lib/db/models/BalanceSheetItem"
import {
  UpdateBalanceSheetItemSchema,
  DeleteBalanceSheetItemSchema,
} from "@/lib/db/validators/balance-sheet-item"
import { parseBusinessDateInput } from "@/lib/utils/time"

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      )
    }

    const payload = UpdateBalanceSheetItemSchema.parse(await request.json())
    const effectiveDate = parseBusinessDateInput(payload.effectiveDate)
    if (!effectiveDate) {
      return NextResponse.json(
        { success: false, error: "Invalid effective date" },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const existing = await BalanceSheetItem.findOne({ store, groupId: id })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      )
    }

    await BalanceSheetItem.create({
      store,
      groupId: id,
      category: payload.category,
      name: payload.name.trim(),
      amount: payload.amount,
      effectiveDate,
      status: "active",
      notes: payload.notes?.trim() ?? "",
      createdBy: session.userId,
    })

    return NextResponse.json({
      success: true,
      data: {
        groupId: id,
        category: payload.category,
        name: payload.name.trim(),
        amount: payload.amount,
        effectiveDate: payload.effectiveDate,
        notes: payload.notes?.trim() ?? "",
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update balance sheet item"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      )
    }

    // DELETE may carry an optional effective date; default to now if the body is empty.
    let effectiveDate = new Date()
    const raw = await request.text()
    if (raw.trim().length > 0) {
      const parsed = DeleteBalanceSheetItemSchema.parse(JSON.parse(raw))
      if (parsed.effectiveDate) {
        const resolved = parseBusinessDateInput(parsed.effectiveDate)
        if (!resolved) {
          return NextResponse.json(
            { success: false, error: "Invalid effective date" },
            { status: 400 }
          )
        }
        effectiveDate = resolved
      }
    }

    await connectToDatabase()
    // Base the tombstone on the most recent version so required fields stay populated.
    const latest = await BalanceSheetItem.findOne({ store, groupId: id }).sort({
      effectiveDate: -1,
      createdAt: -1,
    })
    if (!latest) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      )
    }

    await BalanceSheetItem.create({
      store,
      groupId: id,
      category: latest.category,
      name: latest.name,
      amount: latest.amount,
      effectiveDate,
      status: "deleted",
      notes: latest.notes ?? "",
      createdBy: session.userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete balance sheet item"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
