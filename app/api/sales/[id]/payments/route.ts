// Records installment payments against unpaid loan sales.
import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Sale } from "@/lib/db/models/Sale"
import {
  ensureInitialSaleSnapshot,
  recordSaleSnapshot,
} from "@/lib/financial/sale-snapshot-history"

const LoanPaymentSchema = z
  .object({
    amount: z.number().positive(),
    paymentMethod: z.enum(["cash", "bank", "mobile"]),
    notes: z.string().optional(),
  })
  .strict()

type LoanPayment = {
  amount?: number
}

// Sentinel for a concurrent update racing this payment (sale settled/edited mid-flight).
class PaymentConflictError extends Error {
  constructor() {
    super("Failed to record payment")
  }
}

type LoanSaleForPayment = {
  _id: { toString(): string }
  store: string
  items: unknown[]
  totalAmount: number
  paymentStatus?: "paid" | "unpaid"
  paymentMethod?: "cash" | "bank" | "mobile"
  amountPaid?: number
  remainingBalance?: number
  payments?: LoanPayment[]
  createdAt?: Date
  createdBy: unknown
  customer?: {
    name?: string
    phone?: string
  }
  outstanding?: {
    customerName?: string
    customerPhone?: string
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function sumPayments(payments: LoanPayment[] | undefined) {
  if (!Array.isArray(payments)) return 0
  return roundMoney(
    payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
  )
}

function getRemainingBalance(sale: LoanSaleForPayment) {
  if (typeof sale.remainingBalance === "number") {
    return roundMoney(sale.remainingBalance)
  }

  const amountPaid =
    typeof sale.amountPaid === "number"
      ? sale.amountPaid
      : sumPayments(sale.payments)
  return Math.max(0, roundMoney(sale.totalAmount - amountPaid))
}

export async function POST(
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
    const payload = LoanPaymentSchema.parse(await request.json())

    const db = await connectToDatabase()
    const sale = await Sale.findOne({
      _id: id,
      store,
      paymentStatus: "unpaid",
    }).lean<LoanSaleForPayment | null>()

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Unpaid loan sale not found" },
        { status: 404 }
      )
    }

    const remainingBalance = getRemainingBalance(sale)
    const amount = roundMoney(payload.amount)

    if (amount > remainingBalance) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment amount cannot exceed the remaining loan balance",
        },
        { status: 400 }
      )
    }

    const currentAmountPaid =
      typeof sale.amountPaid === "number"
        ? sale.amountPaid
        : sumPayments(sale.payments)
    const amountPaid = roundMoney(currentAmountPaid + amount)
    const nextRemainingBalance = Math.max(
      0,
      roundMoney(remainingBalance - amount)
    )
    const isSettled = nextRemainingBalance === 0
    const customerFromOutstanding =
      sale.outstanding && !sale.customer
        ? {
            name: sale.outstanding.customerName ?? "",
            phone: sale.outstanding.customerPhone ?? "",
          }
        : undefined

    const paidAt = new Date()
    const update = {
      $push: {
        payments: {
          amount,
          paymentMethod: payload.paymentMethod,
          paidAt,
          receivedBy: session.userId,
          notes: payload.notes?.trim() ?? "",
        },
      },
      $set: {
        amountPaid,
        remainingBalance: nextRemainingBalance,
        ...(isSettled
          ? {
              paymentStatus: "paid",
              paymentMethod: payload.paymentMethod,
              ...(customerFromOutstanding
                ? { customer: customerFromOutstanding }
                : {}),
            }
          : {}),
      },
      ...(isSettled ? { $unset: { outstanding: "" } } : {}),
    }

    // The payment, invoice status, and sale snapshot must land together — a payment
    // persisted without its snapshot would freeze the loan as fully outstanding on
    // every backdated balance sheet.
    let updatedSale: LoanSaleForPayment | null = null
    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        await ensureInitialSaleSnapshot(sale, dbSession)

        updatedSale = await Sale.findOneAndUpdate(
          { _id: sale._id, store, paymentStatus: "unpaid" },
          update,
          { new: true, session: dbSession }
        ).lean<LoanSaleForPayment | null>()

        if (!updatedSale) {
          throw new PaymentConflictError()
        }

        if (isSettled) {
          await Invoice.updateOne(
            { saleId: sale._id, store },
            { status: "paid" },
            { session: dbSession }
          )
        }

        await recordSaleSnapshot(
          updatedSale,
          isSettled ? "settled" : "payment",
          paidAt,
          dbSession
        )
      })
    } finally {
      await dbSession.endSession()
    }

    return NextResponse.json({ success: true, data: updatedSale })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid payment details." },
        { status: 400 }
      )
    }
    if (error instanceof PaymentConflictError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    const message =
      error instanceof Error ? error.message : "Failed to record payment."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
