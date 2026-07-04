// Validates proforma document payloads and list-query filters.
import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

const optionalTextSchema = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.union([z.string(), z.undefined()])
  )
  .optional()

const optionalEmailSchema = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.union([z.string().email(), z.undefined()])
  )
  .optional()

const discountTypeSchema = z.enum(["percentage", "amount"]).optional()
const discountValueSchema = z.coerce.number().min(0).optional()

function refineDiscountFields(
  value: { discountType?: "percentage" | "amount"; discountValue?: number },
  ctx: z.RefinementCtx
) {
  const hasType = value.discountType !== undefined
  const hasValue = value.discountValue !== undefined

  if (hasType !== hasValue) {
    ctx.addIssue({
      code: "custom",
      message: "Provide both a discount type and a discount value",
      path: hasType ? ["discountValue"] : ["discountType"],
    })
    return
  }

  if (
    value.discountType === "percentage" &&
    value.discountValue !== undefined &&
    value.discountValue > 100
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Percentage discounts cannot exceed 100",
      path: ["discountValue"],
    })
  }
}

const ProformaItemSchema = z
  .object({
    description: z.string().min(1),
    unit: z.string().min(1).optional().default("pcs"),
    quantity: z.coerce.number().int().min(1),
    unitPrice: z.coerce.number().min(0),
    discountType: discountTypeSchema,
    discountValue: discountValueSchema,
  })
  .superRefine(refineDiscountFields)

export const CreateProformaSchema = z
  .object({
    saleId: objectIdSchema.optional(),
    customerName: z.string().min(1),
    customerEmail: optionalEmailSchema,
    customerPhone: optionalTextSchema,
    items: z.array(ProformaItemSchema).min(1).optional(),
    discountType: discountTypeSchema,
    discountValue: discountValueSchema,
    expiresAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine(refineDiscountFields)
  .refine((value) => value.saleId || value.items?.length, {
    message: "Provide saleId or at least one item",
  })

export const UpdateProformaSchema = z
  .object({
    customerName: z.string().min(1),
    customerEmail: optionalEmailSchema,
    customerPhone: optionalTextSchema,
    items: z.array(ProformaItemSchema).min(1),
    discountType: discountTypeSchema,
    discountValue: discountValueSchema,
    expiresAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine(refineDiscountFields)

export const ProformaListQuerySchema = z.object({
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})
