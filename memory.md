# Memory — On-Screen Financial Statement Tables

Last updated: 2026-07-22

## What was built

- **Income Statement on-screen table** (`components/financial-statements/income-statement-view.tsx`): replaced the `<dl>` list with a bordered `Description | Amount` grid — `bg-muted` header band, full `border-border` cell borders, `bg-muted/30` zebra on odd line rows, subtotal `bg-muted/50 font-medium`, grand-total (Net Profit) `border-t-2 border-t-accent bg-muted/60 font-semibold` keeping emerald/rose value-by-sign coloring. Amounts `text-right tabular-nums`.
- **Balance Sheet on-screen tables** (`components/financial-statements/balance-sheet-view.tsx`): kept the two side-by-side cards (`grid items-start gap-4 lg:grid-cols-2`) but each is now ONE bordered table — **Assets** (left) and **Liabilities & Equity** (right, combining the Liabilities + Equity sections). Removed the old `LineRows`/`Subtotal` helpers; added a `StatementRow` discriminated-union row-model + `BandRow` / `EmptyRow` / `DataRow` / `TotalRow` / `SideTable` components. Sub-groups (Current/Fixed Assets, Current/Long-term Liabilities, Equity) = full-width `bg-muted` uppercase band rows; empty groups = "None recorded." cell; section closers use `subtotal` vs `grand` total styling. Preserved: comparison column (now a proper middle column headed by the compare date), per-total emerald/rose deltas inside the amount cell, inline manual-item edit/delete (`icon-xs` ghost Pencil/Trash2), balance-check banner, warnings banner, compare caption.
- Updated `context/ui-registry.md` (Statement tables / Balance sheet layout / Comparison column rows) and `context/progress-tracker.md`.

## Decisions made

- On-screen statements deliberately mirror the PDF bordered-grid look, using **theme tokens** (`bg-muted`, `border-border`, `border-t-accent`) rather than the lighter `components/ui/table.tsx` primitive — so light and dark themes both track.
- Balance sheet kept its **two side-by-side tables** (user choice) rather than the PDF's single stacked flow; the right side merges Liabilities + Equity into one table.
- Rendering-only: no data, routes, payloads, or statement math touched.

## Problems solved

- React Compiler (`react-hooks/immutability`) **rejects a mutable render counter** — a zebra-stripe counter `let dataIndex; dataIndex += 1` inside `.map` failed lint with "Cannot reassign variable after render completes". Fixed by deriving parity without mutation: `rows.slice(0, index).filter((r) => r.kind === "line").length % 2 === 1` (so band/total rows never break the zebra rhythm). This is the standard trap in these views — they also forbid manual `useMemo`/`useCallback` for derived values and synchronous `setState` in effects.

## Current state

- Both view files are **eslint-clean** and **tsc-clean**. `npm run build` was NOT run; no live app run; nothing committed — working tree has the two view files + the two context docs uncommitted.
- `npx tsc --noEmit` surfaces **pre-existing, unrelated** Mongoose-typing errors in API routes (`app/api/products/[id]/receipts/route.ts`, `app/api/sales/[id]/payments/route.ts`, `app/api/sales/[id]/route.ts`) — not introduced this session, left alone.

## Next session starts with

- If wanted: run `npm run build` (may need network for font fetching) and/or commit the working-tree changes. User was asked and had not yet answered.

## Open questions

- Build + commit pending user go-ahead.
- Still open from the prior session (unchanged): whether to unify the three inventory-valuation sites (Reports/Dashboard live last-in `costPrice` vs Balance Sheet as-of WAC reconstruction) — needs `/architect`; and whether removing the retail "Inventory Value" card from the report PDF matched intent (offered to revert to screen-only).
