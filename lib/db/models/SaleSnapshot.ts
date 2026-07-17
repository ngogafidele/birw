// Stores immutable sale versions for historical financial statement snapshots.
import mongoose, { Schema } from "mongoose"

const SnapshotSaleItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true, default: "pcs" },
    quantity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const SnapshotCustomerSchema = new Schema(
  {
    name: { type: String },
    phone: { type: String },
  },
  { _id: false }
)

const SnapshotOutstandingSchema = new Schema(
  {
    customerName: { type: String },
    customerPhone: { type: String },
    paymentDate: { type: Date },
  },
  { _id: false }
)

const SnapshotPaymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "mobile"],
      required: true,
    },
    paidAt: { type: Date, required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "" },
  },
  { _id: false }
)

const SaleSnapshotSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1"],
      required: true,
    },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    effectiveAt: { type: Date, required: true },
    reason: {
      type: String,
      enum: ["created", "edited", "payment", "settled", "deleted"],
      required: true,
    },
    items: { type: [SnapshotSaleItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "mobile"],
      default: undefined,
    },
    customer: { type: SnapshotCustomerSchema, default: undefined },
    outstanding: { type: SnapshotOutstandingSchema, default: undefined },
    payments: { type: [SnapshotPaymentSchema], default: [] },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    remainingBalance: { type: Number, required: true, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

SaleSnapshotSchema.index({ store: 1, saleId: 1, effectiveAt: 1, createdAt: 1 })
SaleSnapshotSchema.index({ store: 1, effectiveAt: 1 })

export type SaleSnapshotDocument =
  mongoose.InferSchemaType<typeof SaleSnapshotSchema>

export const SaleSnapshot =
  (mongoose.models.SaleSnapshot as mongoose.Model<SaleSnapshotDocument>) ||
  mongoose.model<SaleSnapshotDocument>("SaleSnapshot", SaleSnapshotSchema)
