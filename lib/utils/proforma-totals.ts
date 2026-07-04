// Computes proforma discount snapshots, line totals, and document totals.

export type ProformaDiscountInput = {
  discountType?: "percentage" | "amount"
  discountValue?: number
}

export type ProformaItemInput = ProformaDiscountInput & {
  description: string
  unit?: string
  quantity: number
  unitPrice: number
}

export type ProformaDiscountSnapshot = {
  type: "percentage" | "amount"
  value: number
  amount: number
}

export type ComputedProformaItem = {
  description: string
  unit: string
  quantity: number
  unitPrice: number
  discount?: ProformaDiscountSnapshot
  lineTotal: number
}

export type ProformaTotalsResult =
  | {
      ok: true
      items: ComputedProformaItem[]
      subtotalAmount: number
      discount?: ProformaDiscountSnapshot
      totalAmount: number
    }
  | { ok: false; error: string }

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function resolveDiscount(
  input: ProformaDiscountInput,
  base: number
): ProformaDiscountSnapshot | null {
  if (input.discountType === undefined || input.discountValue === undefined) {
    return null
  }

  const amount = roundMoney(
    input.discountType === "percentage"
      ? (base * input.discountValue) / 100
      : input.discountValue
  )

  return { type: input.discountType, value: input.discountValue, amount }
}

// Row discounts reduce each line first; the document discount then applies
// to the discounted subtotal. Discounts may never push a value below zero.
export function computeProformaTotals(
  items: ProformaItemInput[],
  documentDiscount: ProformaDiscountInput
): ProformaTotalsResult {
  const computedItems: ComputedProformaItem[] = []

  for (const [index, item] of items.entries()) {
    const grossTotal = roundMoney(item.quantity * item.unitPrice)
    const discount = resolveDiscount(item, grossTotal)

    if (discount && discount.amount > grossTotal) {
      return {
        ok: false,
        error: `Item ${index + 1}: discount exceeds the line total`,
      }
    }

    computedItems.push({
      description: item.description,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      ...(discount ? { discount } : {}),
      lineTotal: roundMoney(grossTotal - (discount?.amount ?? 0)),
    })
  }

  const subtotalAmount = roundMoney(
    computedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  )
  const discount = resolveDiscount(documentDiscount, subtotalAmount)

  if (discount && discount.amount > subtotalAmount) {
    return { ok: false, error: "Document discount exceeds the subtotal" }
  }

  return {
    ok: true,
    items: computedItems,
    subtotalAmount,
    ...(discount ? { discount } : {}),
    totalAmount: roundMoney(subtotalAmount - (discount?.amount ?? 0)),
  }
}
