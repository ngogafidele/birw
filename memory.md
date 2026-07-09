# Memory — Financial Statements (Income Statement + Balance Sheet)

Last updated: 2026-07-09

## What was built

A new **Financial Statements** section (admin + manager only), delivered in 5 stages. Lint passes clean at every stage; **`npm run build` / typecheck was NOT run (user declined) and there was no live end-to-end run.**

**Auth / nav**
- `lib/auth/middleware.ts` — added `requireManagerOrAdmin` (mirrors `requireAdmin`; admits admin or `role === "manager"`, rejects staff). First admin-and-manager-but-not-staff surface.
- `components/layout/sidebar.tsx` — added **Financial Statements** nav item (lucide `FileSpreadsheet`), shown when `session.isAdmin || session.role === "manager"` (new `isManagerOrAdmin` branch; staff still get `commonNavItems` only).
- `app/(dashboard)/financial-statements/page.tsx` — role-gated server page (redirects staff to `/sales`), renders the client manager.
- `components/financial-statements/financial-statements-manager.tsx` — two-tab toggle built with button state (no Tabs primitive exists in `components/ui`).

**Compute (shared single source of truth) — `lib/financial/`**
- `period.ts` — `resolveIncomeRange(start,end)` (defaults this month→today) and `resolveAsOf(asOf)` (defaults today); use business-date helpers from `lib/utils/time.ts`; `addDays` for endExclusive.
- `income-statement.ts` — `computeIncomeStatement(store, { from?, endExclusive })`. **Structural replica of the Reports page aggregations** (`app/(dashboard)/reports/page.tsx`): revenue net of returns, gross profit nets returned-goods cost, COGS = revenue − grossProfit, sales by `createdAt`, expenses by `date`. Omit `from` → cumulative (used for Retained Earnings).
- `balance-sheet.ts` — `computeBalanceSheet(store, { asOf, endExclusive, asOfInput, manual? })` + `resolveManualItems` + `manualItemsToLines`. Reconstructs Inventory Value, Accounts Receivable, Retained Earnings; assembles grouped structure + `balanceDifference`. Resolves manual items internally when `manual` not passed.

**Model / validator**
- `lib/db/models/BalanceSheetItem.ts` — append-only versioned model: `{ store, groupId, category(enum), name, amount, effectiveDate, status: active|deleted, notes, createdBy }`. `BALANCE_SHEET_CATEGORIES` exported. Each doc is one immutable version sharing `groupId`.
- `lib/db/validators/balance-sheet-item.ts` — Zod Create/Update (same shape) + Delete (optional effectiveDate).

**API routes (all `requireManagerOrAdmin`, store-scoped, `{success,data}`)**
- `income-statement/route.ts` (GET `?start=&end=`) + `income-statement/pdf/route.ts`
- `balance-sheet/route.ts` (GET `?asOf=`) + `balance-sheet/pdf/route.ts`
- `balance-sheet/items/route.ts` (GET resolved-as-of, POST new group)
- `balance-sheet/items/[id]/route.ts` (PUT edit→new version, DELETE→tombstone version). **`[id]` is the `groupId`.**
- PDF routes have `export const runtime = "nodejs"`.

**PDF** — `lib/pdf/financial-statement-generator.ts`: `generateIncomeStatementPDF` + `generateBalanceSheetPDF`. Same PDFKit loader/logo pattern as `outstanding-generator.ts`, uses `PDF_COLORS` + `STORE_DOCUMENT_DETAILS[store]`.

**Views** — `income-statement-view.tsx` (presets This/Last Month, This Year + custom range) and `balance-sheet-view.tsx` (As-Of picker, grouped layout, Balance Check card, manual-item CRUD dialog with grouped `Select`, inline edit/delete). Both have Download PDF buttons.

**Docs** — updated `context/progress-tracker.md` (Implemented + Operational Notes) and `context/ui-registry.md` (new Financial Statements section).

## Decisions made

(Confirmed by the user via AskUserQuestion — the heavier option was chosen each time.)
- **Historical reconstruction** for balance-sheet as-of past dates (not "today only").
- **Inventory valuation = latest receipt `unitCost` on/before date**, fallback latest `Sale.items.basePrice`, then current `Product.costPrice`. Quantity reconstructed by rewinding current stock by movements dated ≥ endExclusive (receipts/sales/returns/replacements/adjustments — same sources as `app/api/products/[id]/movements`). Negative reconstructed qty floored out of valuation.
- **Accounts Receivable** = for loan sales (`outstanding != null`) created < endExclusive: `totalAmount − Σ payments(paidAt < endExclusive)`, floored at 0.
- **Shared lib module** replicates Reports math; Reports page left untouched (intentional duplication, keep in sync).
- **One route + two tabs**, not two nav items.
- **Versioned immutable manual items**: edits/deletes insert new effective-dated versions; snapshots resolve to the latest version with `effectiveDate ≤ asOf`, dropping tombstoned groups. Never mutate/hard-delete a version.
- **Balance Check** shows plain `assets − (liabilities + equity)` difference; **no cash auto-derived** (users add a manual "Cash & Bank" item).
- **No existing schema modified** (Product/Sale/Expense/ProductReceipt/StockAdjustment/Return are read-only). Only new model is `BalanceSheetItem`.

## Problems solved

- **`StockMovement` / `Outstanding` / `Customer` collections do NOT exist** (the original prompt assumed them). Cost lives on `Sale.items.basePrice`; AR is remaining balance/payment history on unpaid sales with an `outstanding` subdoc.
- **`react-hooks/set-state-in-effect` is an ERROR in this repo's lint.** Calling a fetch wrapper that synchronously calls `setState` inside a `useEffect` triggers it (even one call-layer removed). Fix: initialize `loading: true` and, in the mount effect, only set state **after** the await (`.then/.catch/.finally`); keep synchronous `setState` in click handlers only. Capture initial range/as-of via `useState(() => ...)` so effect deps stay clean (no eslint-disable).
- Reports COGS is *net of returns* — the income statement had to mirror that exactly or the two pages disagree.

## Current state

- All 5 stages implemented; **lint clean (exit 0), no issues in any new file.**
- Not build-verified, not run against a live DB.
- Two cosmetic choices left as-is pending user preference: (1) income statement renders COGS & Operating Expenses as **negative** figures; (2) manual-item **delete uses `window.confirm`** (not a styled dialog).

## Next session starts with

1. **Run `npm run build`** — the only prescribed check not yet done; catches type errors lint misses (PDF generator types, Mongoose aggregation generics).
2. **Live verify parity:** open `/financial-statements`, confirm the Income Statement equals `/reports` for the same range on real data (should match by construction). Use the `/verify` skill (needs dev server + MongoDB).
3. Optionally address the two cosmetic choices if the user wants them changed.

## Open questions

- User has not confirmed the two cosmetic choices (negative COGS/expense sign; `window.confirm` delete).
- New heavy aggregations assume MongoDB is a replica set (app already uses transactions elsewhere, so presumably fine) — not verified against the actual deployment.
- Balance-sheet inventory reconstruction fires ~8 aggregations + a full product scan per request; fine at this store's scale but a future perf spot (could add an "as-of = today" fast path using live `quantity`).
