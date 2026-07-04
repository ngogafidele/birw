// Persists branch quotation documents issued before or alongside sales.
import mongoose, { Schema } from "mongoose"

const ProformaDiscountSchema = new Schema(
  {
    type: { type: String, enum: ["percentage", "amount"], required: true },
    value: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const ProformaItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    unit: { type: String, required: true, default: "pcs", trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: ProformaDiscountSchema },
    // Net line total after the row discount is applied.
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const ProformaSchema = new Schema(
  {
    storeId: {
      type: String,
      enum: ["store1"],
      required: true,
    },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    proformaNumber: { type: String, required: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: "", trim: true },
    customerPhone: { type: String, default: "", trim: true },
    items: { type: [ProformaItemSchema], required: true },
    // Sum of net line totals before the document-level discount.
    subtotalAmount: { type: Number, min: 0 },
    discount: { type: ProformaDiscountSchema },
    totalAmount: { type: Number, required: true, min: 0 },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
  },
  { timestamps: true }
)

ProformaSchema.index({ storeId: 1 })
ProformaSchema.index({ storeId: 1, saleId: 1 })
ProformaSchema.index({ storeId: 1, proformaNumber: 1 }, { unique: true })

export type ProformaDocument = mongoose.InferSchemaType<typeof ProformaSchema>

export const Proforma =
  (mongoose.models.Proforma as mongoose.Model<ProformaDocument>) ||
  mongoose.model<ProformaDocument>("Proforma", ProformaSchema)
