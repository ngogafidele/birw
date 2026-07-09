// Updates or reverses a return while reconciling branch inventory.
import { NextRequest, NextResponse } from "next/server"
import type { ClientSession } from "mongoose"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest, type StoreKey } from "@/lib/auth/session"
import { UpdateReturnSchema } from "@/lib/db/validators/return"
import { syncLowStockAlert } from "@/lib/db/alerts"

type ReturnItemInput = {
  productId: string
  quantity: number
  unitPrice: number
}

type ProductDocumentLike = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  price: number
  costPrice?: number
  lowStockThreshold?: number
}

class RouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

type StockUpdate = {
  productId: string
  delta: number
}

async function applyReturnStockUpdates(
  updates: StockUpdate[],
  store: StoreKey,
  session: ClientSession
) {
  for (const update of updates) {
    if (update.delta === 0) continue

    const filter =
      update.delta < 0
        ? {
            _id: update.productId,
            store,
            quantity: { $gte: Math.abs(update.delta) },
          }
        : { _id: update.productId, store }

    const result = await Product.updateOne(
      filter,
      { $inc: { quantity: update.delta } },
      { session }
    )

    if (result.matchedCount !== 1) {
      throw new RouteError("Stock would go negative", 400)
    }
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

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    const payload = UpdateReturnSchema.parse(await request.json())

    const db = await connectToDatabase()
    let products: ProductDocumentLike[] = []
    let updates: StockUpdate[] = []
    let updatedReturn

    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        const existingReturn = await ReturnModel.findOne({ _id: id, store }).session(
          dbSession
        )
        if (!existingReturn) {
          throw new RouteError("Return not found", 404)
        }

        const returnItemsInput = payload.returnItems
          ? payload.returnItems.map((item: ReturnItemInput) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            }))
          : existingReturn.returnItems.map((item) => ({
              productId: item.productId.toString(),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            }))

        const allProductIds = Array.from(
          new Set([
            ...existingReturn.returnItems.map((item) => item.productId.toString()),
            ...existingReturn.replacementItems.map((item) =>
              item.productId.toString()
            ),
            ...returnItemsInput.map((item) => item.productId),
          ])
        )

        products = (await Product.find({
          _id: { $in: allProductIds },
          store,
        }).session(dbSession)) as ProductDocumentLike[]

        if (products.length !== allProductIds.length) {
          throw new RouteError("One or more products not found", 404)
        }

        const productMap = new Map(
          products.map((product) => [product._id.toString(), product])
        )

        let totalReturnAmount = 0
        const returnItems = returnItemsInput.map((item) => {
          const product = productMap.get(item.productId)
          if (!product) {
            throw new RouteError("Product not found", 404)
          }

          const lineTotal = item.unitPrice * item.quantity
          totalReturnAmount += lineTotal

          return {
            productId: product._id,
            name: product.name,
            sku: product.sku,
            unit: product.unit ?? "pcs",
            quantity: item.quantity,
            basePrice: product.costPrice ?? product.price,
            unitPrice: item.unitPrice,
            lineTotal,
          }
        })

        const oldNetMap = new Map<string, number>()
        existingReturn.returnItems.forEach((item) => {
          const current = oldNetMap.get(item.productId.toString()) ?? 0
          oldNetMap.set(item.productId.toString(), current + item.quantity)
        })
        existingReturn.replacementItems.forEach((item) => {
          const current = oldNetMap.get(item.productId.toString()) ?? 0
          oldNetMap.set(item.productId.toString(), current - item.quantity)
        })

        const newNetMap = new Map<string, number>()
        returnItems.forEach((item) => {
          const current = newNetMap.get(item.productId.toString()) ?? 0
          newNetMap.set(item.productId.toString(), current + item.quantity)
        })

        updates = []
        for (const productId of allProductIds) {
          const oldNet = oldNetMap.get(productId) ?? 0
          const newNet = newNetMap.get(productId) ?? 0
          const delta = newNet - oldNet
          if (delta === 0) continue

          if (!productMap.has(productId)) {
            throw new RouteError("Product not found", 404)
          }

          updates.push({ productId, delta })
        }

        await applyReturnStockUpdates(updates, store, dbSession)

        const updateInput: Record<string, unknown> = {
          returnItems,
          replacementItems: [],
          totalReturnAmount,
          totalReplacementAmount: 0,
          notes:
            typeof payload.notes === "string"
              ? payload.notes.trim()
              : existingReturn.notes,
        }

        updatedReturn = await ReturnModel.findOneAndUpdate(
          { _id: id, store },
          updateInput,
          { returnDocument: "after", runValidators: true, session: dbSession }
        )

        if (!updatedReturn) {
          throw new RouteError("Return not found", 404)
        }
      })
    } finally {
      await dbSession.endSession()
    }

    try {
      await Promise.all(
        updates.map(async (entry) => {
          const product = products.find(
            (item) => item._id.toString() === entry.productId
          )
          if (!product) return
          await syncLowStockAlert({
            store,
            productId: entry.productId,
            name: product.name,
            sku: product.sku,
            quantity: product.quantity + entry.delta,
            threshold: product.lowStockThreshold ?? 0,
          })
        })
      )
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json({ success: true, data: updatedReturn })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update return"
    const status = error instanceof RouteError ? error.status : 400
    return NextResponse.json(
      { success: false, error: message },
      { status }
    )
  }
}

export async function DELETE(
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

    const db = await connectToDatabase()
    let products: ProductDocumentLike[] = []
    let updates: StockUpdate[] = []

    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        const existingReturn = await ReturnModel.findOne({ _id: id, store }).session(
          dbSession
        )

        if (!existingReturn) {
          throw new RouteError("Return not found", 404)
        }

        const productIds = Array.from(
          new Set([
            ...existingReturn.returnItems.map((item) => item.productId.toString()),
            ...existingReturn.replacementItems.map((item) =>
              item.productId.toString()
            ),
          ])
        )

        products = (await Product.find({
          _id: { $in: productIds },
          store,
        }).session(dbSession)) as ProductDocumentLike[]

        if (products.length !== productIds.length) {
          throw new RouteError("One or more products not found", 404)
        }

        const netChanges = new Map<string, number>()
        existingReturn.returnItems.forEach((item) => {
          const current = netChanges.get(item.productId.toString()) ?? 0
          netChanges.set(item.productId.toString(), current + item.quantity)
        })
        existingReturn.replacementItems.forEach((item) => {
          const current = netChanges.get(item.productId.toString()) ?? 0
          netChanges.set(item.productId.toString(), current - item.quantity)
        })

        updates = Array.from(netChanges.entries()).map(([productId, change]) => ({
          productId,
          delta: -change,
        }))

        await applyReturnStockUpdates(updates, store, dbSession)
        await existingReturn.deleteOne({ session: dbSession })
      })
    } finally {
      await dbSession.endSession()
    }

    try {
      await Promise.all(
        updates.map(async (entry) => {
          const product = products.find(
            (item) => item._id.toString() === entry.productId
          ) as ProductDocumentLike | undefined
          if (!product) return
          await syncLowStockAlert({
            store,
            productId: entry.productId,
            name: product.name,
            sku: product.sku,
            quantity: product.quantity + entry.delta,
            threshold: product.lowStockThreshold ?? 0,
          })
        })
      )
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete return"
    const status = error instanceof RouteError ? error.status : 400
    return NextResponse.json(
      { success: false, error: message },
      { status }
    )
  }
}
