# Memory — Product Stock Monitor, Batch Add, and Proforma PDF Discount Column

Last updated: 2026-07-04

## What was built

Three features this session, in order. **None have been lint/build-verified yet** (the user declined `npm run lint` / `npm run build` several times).

1. **Proforma PDF discount column** (`lib/pdf/invoice-generator.ts`):
   - Added a `showDiscountColumn` param to `writeInvoicePdf` (defaults false; `generateProformaPDF` passes `true`, sales invoices stay false → invoice layout byte-identical).
   - Proformas now render a dedicated **DISCOUNT** table column instead of a discount note in the item description sub-line. Columns switch to a 6-column layout when the flag is on (proforma x-positions: no 52 / item 78 w148 / qty 230 w50 / price 288 w66 / discount 360 w78 / total 444 w103); invoice keeps the original 5-column set.
   - Per-row discount cell: percentage rows show `10%` main + muted `-amount` sub; amount rows show `-amount`; no discount shows `—`. The item sub-line reverted to SKU-only. Removed the now-unused `formatDiscountNote` helper.
   - The Subtotal/Discount/Total totals block was reparametrized to `columns.price` / `columns.total` / `columns.totalWidth` (identical output for invoices).

2. **Product Stock Monitor** (admin-only, read-only movement history modal):
   - `app/api/products/[id]/movements/route.ts` (new, GET, `requireAdmin`): reconstructs history by merging `ProductReceipt` (in), `Return.returnItems` (in) / `replacementItems` (out), `Sale.items` incl. loans (out), `StockAdjustment` (±). Sorts ascending, walks a running balance **anchored to the true `product.quantity`** (opening balance = currentQuantity − netFromEvents). Returns `{ product, openingBalance, currentQuantity, totals, breakdown, balanceSeries, events }` (events newest-first).
   - `components/products/stock-movement-charts.tsx` (new, recharts): `StockBalanceChart` (stepAfter AreaChart) + `StockBreakdownChart` (BarChart, per-Cell fill). Colors use `--chart-1` (in) / `--chart-2` (out) tokens.
   - `components/products/product-monitor-dialog.tsx` (new): responsive Dialog (`sm:max-w-3xl max-h-[90vh] overflow-y-auto`), stat tiles (Opening/In/Out/Current), both charts, color-coded event table. Includes a **time-range selector** (30d / 90d / 1y / All) that re-derives everything **client-side** from the full history via `deriveView()` — a bounded range recomputes its own opening balance, totals, breakdown, and series (no refetch).
   - Wired a **Monitor** button (lucide `Activity`, first in the admin Actions cell) into `products-manager.tsx`.

3. **Batch multi-product add** (`components/products/products-manager.tsx`):
   - Extracted a shared `ProductFields` component (Name/Unit/Quantity/Threshold/Cost/Selling + optional supplier) used by both edit and each create row.
   - Added `CreateEntry = FormState & { _error?: string }`, `entries` state, `makeEntry`/`updateEntry`/`addEntry`/`removeEntry`.
   - Split `submitForm` into `submitEdit` (PUT, single) and `submitCreate` (batch). `submitForm` now just routes on `activeProductId`.
   - The Add dialog (create mode) is widened (`sm:max-w-2xl max-h-[90vh] overflow-y-auto`) and renders repeatable entry cards with add/remove; edit mode stays single-entry, default width, no supplier fields.
   - `submitCreate` validates all rows, then POSTs each through the existing `/api/products` sequentially; successes prepend to the list, failures stay in the dialog with per-row `_error`, banner summarizes ("Created N products. M still need attention.").

- Installed **`recharts@^3.9.2`** (React 19 compatible). Install needed `dangerouslyDisableSandbox: true` — the sandbox blocks network (ECONNRESET); the plain `npm install` failed first.
- Updated `context/progress-tracker.md` and `context/ui-registry.md` for both the Monitor and batch-add features.

## Decisions made

- **No stock-movement ledger exists** — the Monitor reconstructs on demand from the 4 source collections (chosen over adding a persisted ledger: smallest safe change).
- **Balance anchored to live quantity.** Product create/edit set `quantity` directly (not recorded anywhere), so the reconstructed net won't equal current stock; the residual is surfaced as an explicit "Opening / unitemized adjustments" baseline so the line always ends at true stock.
- **Monitor is admin-only** (consistent with the admin-only Actions column). Chose **recharts** over custom SVG (user's call). Time range is **all-time by default with a selector**; ranges are derived client-side, not server-side.
- **Batch add reuses the single-product endpoint per row** (not a new batch endpoint) so SKU generation, supplier receipts, and low-stock sync stay identical; rows submit sequentially for predictable SKU order; partial success is intentional (failed rows stay for correction).
- Chart colors must stay on `--chart-*` tokens (no hardcoded hex).

## Problems solved

- `npm install recharts` failed with ECONNRESET under the sandbox; succeeded only with `dangerouslyDisableSandbox: true`.
- Duplicate product name **within one batch** is handled naturally: the 2nd identical row gets a 409 from the unique index and stays in the dialog for correction.
- Removed the unused `formatDiscountNote` (and top-level `showPriceWarning`/`costValue`/`priceValue`, now inside `ProductFields`) to avoid unused-symbol lint.

## Current state

- All code + context docs written. `recharts` installed.
- **NOT verified:** `npm run lint` and `npm run build` have not been run this session (user declined). Manual UI verification also pending.

## Next session starts with

1. Run `npm run lint` and `npm run build` (build may need network/sandbox-disabled for Next font fetching — ask first). Fix anything they surface. Existing baseline was ~38 lint warnings.
2. Manually verify:
   - Proforma PDF: download one with a percentage row discount + an amount row discount + a document discount; confirm the new DISCOUNT column renders correctly and a sales-invoice PDF is unchanged.
   - Monitor modal: open on a product with receipts + sales + a loan + a return + an adjustment; confirm the balance line ends at the live quantity, and the 30d/90d/1y/All selector re-derives tiles, charts, and table correctly (incl. window opening balance).
   - Batch add: create several products at once (incl. one with supplier), force one failure (duplicate name) and confirm only the failed row stays with its error while the others are created.

## Open questions

- Large batches make N sequential requests; add a dedicated batch endpoint if very large batches are expected (not needed for normal use).
- Proforma-from-sale discount timing and whether sales invoices should ever inherit proforma discounts (carried over, still open).
- ~38 pre-existing lint warnings remain unaddressed.
