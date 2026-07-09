// Validates manual balance sheet item payloads.
import { z } from "zod"
import { BALANCE_SHEET_CATEGORIES } from "@/lib/db/models/BalanceSheetItem"

const categorySchema = z.enum(BALANCE_SHEET_CATEGORIES)

// Create and edit both write a new version, so they share the same required shape.
export const CreateBalanceSheetItemSchema = z
  .object({
    category: categorySchema,
    name: z.string().min(1),
    amount: z.number().min(0),
    effectiveDate: z.string().min(1),
    notes: z.string().optional(),
  })
  .strict()

export const UpdateBalanceSheetItemSchema = CreateBalanceSheetItemSchema

// Delete records a tombstone version effective from the given date (defaults to today).
export const DeleteBalanceSheetItemSchema = z
  .object({
    effectiveDate: z.string().min(1).optional(),
  })
  .strict()
