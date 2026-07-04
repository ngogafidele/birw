// Retrieves, updates, or removes one branch proforma invoice.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { Proforma } from "@/lib/db/models/Proforma"
import { UpdateProformaSchema } from "@/lib/db/validators/proforma"
import { computeProformaTotals } from "@/lib/utils/proforma-totals"
import { ZodError } from "zod"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
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
    await connectToDatabase()
    const proforma = await Proforma.findOne({ _id: id, storeId: store })

    if (!proforma) {
      return NextResponse.json(
        { success: false, error: "Proforma not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: proforma })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch proforma" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
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
    await connectToDatabase()
    const proforma = await Proforma.findOneAndDelete({ _id: id, storeId: store })

    if (!proforma) {
      return NextResponse.json(
        { success: false, error: "Proforma not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to delete proforma" },
      { status: 400 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!session.isAdmin && session.role === "staff") {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
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
    const payload = UpdateProformaSchema.parse(await request.json())
    const totals = computeProformaTotals(payload.items, {
      discountType: payload.discountType,
      discountValue: payload.discountValue,
    })

    if (!totals.ok) {
      return NextResponse.json(
        { success: false, error: totals.error },
        { status: 400 }
      )
    }

    const update: Record<string, unknown> = {
      $set: {
        customerName: payload.customerName,
        customerEmail: payload.customerEmail ?? "",
        customerPhone: payload.customerPhone ?? "",
        items: totals.items,
        subtotalAmount: totals.subtotalAmount,
        totalAmount: totals.totalAmount,
        ...(totals.discount ? { discount: totals.discount } : {}),
        ...(payload.expiresAt
          ? { expiresAt: new Date(payload.expiresAt) }
          : {}),
      },
    }
    // A removed document discount must be unset, not left stale.
    if (!totals.discount) {
      update.$unset = { discount: "" }
    }

    await connectToDatabase()
    const proforma = await Proforma.findOneAndUpdate(
      { _id: id, storeId: store },
      update,
      { returnDocument: "after", runValidators: true }
    )

    if (!proforma) {
      return NextResponse.json(
        { success: false, error: "Proforma not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: proforma })
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues
            .map((issue) => {
              const field = issue.path.join(".")
              return field ? `${field}: ${issue.message}` : issue.message
            })
            .join("; ") || "Invalid input"
        : "Failed to update proforma"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
