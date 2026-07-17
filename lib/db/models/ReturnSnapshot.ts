// Stores immutable return versions for historical financial statement snapshots.
import mongoose, { Schema } from "mongoose"

const SnapshotReturnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true, default: "pcs" },
    quantity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, required: true, min: 0, default: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const ReturnSnapshotSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1"],
      required: true,
    },
    returnId: { type: Schema.Types.ObjectId, ref: "Return", required: true },
    effectiveAt: { type: Date, required: true },
    reason: {
      type: String,
      enum: ["created", "edited", "deleted"],
      required: true,
    },
    returnItems: { type: [SnapshotReturnItemSchema], required: true },
    replacementItems: { type: [SnapshotReturnItemSchema], default: [] },
    totalReturnAmount: { type: Number, required: true, min: 0 },
    totalReplacementAmount: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

ReturnSnapshotSchema.index({ store: 1, returnId: 1, effectiveAt: 1, createdAt: 1 })
ReturnSnapshotSchema.index({ store: 1, effectiveAt: 1 })

export type ReturnSnapshotDocument =
  mongoose.InferSchemaType<typeof ReturnSnapshotSchema>

export const ReturnSnapshot =
  (mongoose.models.ReturnSnapshot as mongoose.Model<ReturnSnapshotDocument>) ||
  mongoose.model<ReturnSnapshotDocument>("ReturnSnapshot", ReturnSnapshotSchema)
