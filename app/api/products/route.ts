// Lists and creates products within an authorized store context.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { NumberSequence } from "@/lib/db/models/NumberSequence"
import { Product } from "@/lib/db/models/Product"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest, type StoreKey } from "@/lib/auth/session"
import { CreateProductSchema } from "@/lib/db/validators/product"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { ZodError } from "zod"

const CASE_INSENSITIVE_COLLATION = { locale: "en", strength: 2 } as const

function isDuplicateProductNameError(error: unknown) {
  if (typeof error !== "object" || error === null) return false

  const mongoError = error as {
    code?: unknown
    keyPattern?: Record<string, unknown>
  }

  return mongoError.code === 11000 && Boolean(mongoError.keyPattern?.name)
}

function getSkuBase(name: string) {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]+/g, "")
  return (normalized.slice(0, 6) || "PRD").padEnd(3, "X")
}

function formatSkuSequence(sequence: number) {
  return String(sequence).padStart(4, "0")
}

function getNumericSkuSuffix(sku: string | undefined) {
  const match = sku?.match(/(\d{4})$/)
  return match ? Number(match[1]) : 0
}

async function getMaxExistingSkuSequence(store: StoreKey) {
  const products = await Product.find({ store })
    .select("sku")
    .lean<Array<{ sku?: string }>>()

  return products.reduce(
    (max, product) => Math.max(max, getNumericSkuSuffix(product.sku)),
    0
  )
}

async function getNextProductSkuSequence(store: StoreKey) {
  const filter = {
    storeId: store,
    type: "productSku" as const,
    year: 0,
    month: 0,
  }

  const existingSequence = await NumberSequence.exists(filter)
  if (!existingSequence) {
    const existingMax = await getMaxExistingSkuSequence(store)
    try {
      await NumberSequence.create({ ...filter, sequence: existingMax })
    } catch {
      // Another request may have initialized the SKU counter first.
    }
  }

  const sequence = await NumberSequence.findOneAndUpdate(
    filter,
    { $inc: { sequence: 1 } },
    {
      new: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      upsert: true,
    }
  )

  if (!sequence) {
    throw new Error("Failed to generate product SKU")
  }

  return sequence.sequence
}

async function generateProductSku(store: StoreKey, name: string) {
  const base = getSkuBase(name)

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const sequence = await getNextProductSkuSequence(store)
    const sku = `${base}-${formatSkuSequence(sequence)}`
    const existing = await Product.exists({ store, sku })
    if (!existing) return sku
  }

  throw new Error("Failed to generate a unique product SKU")
}

export async function GET(request: NextRequest) {
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

    await connectToDatabase()
    const products = await Product.find({ store })

    return NextResponse.json({ success: true, data: products })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
        { success: false, error: "Invalid store" },
        { status: 400 }
      )
    }

    const payload = CreateProductSchema.parse(await request.json())
    const {
      categoryId: _categoryId,
      supplierName,
      supplierPhone,
      ...productInput
    } = payload

    await connectToDatabase()

    const duplicateProduct = await Product.exists({
      store,
      name: payload.name,
    }).collation(CASE_INSENSITIVE_COLLATION)

    if (duplicateProduct) {
      return NextResponse.json(
        { success: false, error: "A product with this name already exists" },
        { status: 409 }
      )
    }

    const product = await Product.create({
      ...productInput,
      sku: await generateProductSku(store, payload.name),
      store,
    })

    if (supplierName && supplierPhone && product.quantity > 0) {
      await ProductReceipt.create({
        store,
        productId: product._id,
        sku: product.sku,
        supplierName,
        supplierPhone,
        quantity: product.quantity,
        unitCost: product.costPrice,
        totalCost: product.quantity * product.costPrice,
        receivedAt: new Date(),
        receivedBy: session.userId,
      })
    }

    await syncLowStockAlert({
      store,
      productId: product._id.toString(),
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
      threshold: product.lowStockThreshold ?? 0,
    })

    return NextResponse.json(
      { success: true, data: product },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    if (isDuplicateProductNameError(error)) {
      return NextResponse.json(
        { success: false, error: "A product with this name already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to create product" },
      { status: 400 }
    )
  }
}
