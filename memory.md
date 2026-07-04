# Memory - Proforma Discounts And PDF Identity Order Session

Last updated: 2026-07-04

## What was built

- Proforma discount feature (row-level and document-level, each percentage or fixed amount):
  - `lib/db/models/Proforma.ts`: added `ProformaDiscountSchema` (`type`, `value`, `amount`), optional `discount` on items and on the document, and optional `subtotalAmount`; item `lineTotal` is the NET total after the row discount.
  - `lib/db/validators/proforma.ts`: `discountType`/`discountValue` on item schema and on `CreateProformaSchema`/`UpdateProformaSchema`, with shared `refineDiscountFields` (both-or-neither, percentage <= 100).
  - `lib/utils/proforma-totals.ts` (new): `computeProformaTotals()` — the single source of discount math, used by both API routes and the client form.
  - `app/api/proformas/route.ts` (POST) and `app/api/proformas/[id]/route.ts` (PUT): compute totals via the helper, reject over-limit discounts with 400; PUT `$unset`s a removed document discount so it cannot go stale.
  - `components/invoices/proforma-list.tsx`: per-item discount Select + value input, document discount block, live Subtotal/Discount/Total strip (muted-strip pattern), detail-dialog breakdown, edit hydration, client-side validation mirroring the server.
  - `lib/pdf/invoice-generator.ts`: optional `discount` on `PdfItem`/`PdfDocumentData`; row discounts render as a muted sub-line under the item description; a document discount adds Subtotal/Discount rows above Total (`totalsExtra = 34`) and shifts the stamp/footer down; sales invoice output is unchanged when no discount data is passed.
  - `app/api/proformas/[id]/pdf/route.ts`: passes `subtotalAmount` and discount snapshots to the generator.
- PDF store identity block reorder in `lib/pdf/invoice-generator.ts` and `lib/pdf/outstanding-generator.ts`: now name, TIN, telephone, address, email (was name, address, phone, email, TIN).
- Updated `context/progress-tracker.md` and `context/ui-registry.md` (new "Proforma Discounts" registry section; identity-order notes corrected).

## Decisions made

- Row and document discounts can combine: row discounts reduce each line first, the document discount then applies to the discounted subtotal.
- A fixed-amount row discount comes off the line total, not off each unit.
- Full breakdown display: PDF and detail view show per-line discounts plus Subtotal / Discount / Total when a document discount exists (breakdown rows only render for document discounts; row-only discounts just show on their lines).
- Server is authoritative: clients send only `discountType` + `discountValue`; amounts are computed and snapshotted server-side; discounts may never push a line or the document below zero (rejected, not clamped).
- Discounts are proforma-only; sales invoices are untouched.
- Proformas created from a sale start without discounts.

## Problems solved

- Removing a document discount on edit: plain `findOneAndUpdate` with `undefined` would leave the old `discount` subdoc; the PUT route conditionally adds `$unset: { discount: "" }`.
- Radix Select cannot have an empty-string item value, so the form uses `"none" | "percentage" | "amount"` (`DiscountTypeOption`) and strips "none" before submit via `toDiscountInput()`.

## Current state

- All code and context-doc changes are written. `npm run lint` passed after the discount feature (0 errors; the pre-existing 38-warning baseline).
- NOT yet verified: lint after the identity-block reorder, `npm run build`, and manual workflow checks (create/edit proforma with mixed discounts, PDF download). The user declined the build/lint commands twice near session end, so verification is pending.
- No secrets or credential-like values were saved.

## Next session starts with

1. Run `npm run lint` and `npm run build` (build may need network for Next font fetching — ask before retrying with network access).
2. Manually verify: create a proforma with a percentage row discount + an amount row discount + a document discount; check live totals, detail dialog, list amount, and the downloaded PDF (per-line notes, Subtotal/Discount/Total block, stamp/footer not overlapping); edit a proforma to remove its document discount and confirm it disappears; confirm an over-limit discount returns a clear 400 error.
3. Spot-check a sales invoice PDF and an outstanding statement PDF for the new identity order (name, TIN, tel, address, email) and unchanged layout.

## Open questions

- Should proformas created from a sale (`saleId` path) get a way to add discounts at creation time, or is editing afterwards enough?
- Should sales invoices ever inherit discounts from a discounted proforma, or stay discount-free permanently?
- Existing 38 lint warnings remain unaddressed (carried over from earlier sessions).
