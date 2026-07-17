# Memory — Balance Sheet Accuracy Overhaul (snapshot ledger + auto lines)

Last updated: 2026-07-17

## What was built

Extended the existing Financial Statements feature with an **immutable snapshot ledger** so statements stay historically accurate after later edits/payments/deletions, plus several accounting improvements. **Not build-verified — user has repeatedly declined `npm run build`; no live run.** Lint is clean for all touched files (1 pre-existing error remains in `product-monitor-dialog.tsx`, not mine).

**New models**
- `lib/db/models/SaleSnapshot.ts` — *(already existed at session start, part of prior uncommitted work)* immutable sale versions.
- `lib/db/models/ReturnSnapshot.ts` — **new**, immutable return versions (`created|edited|deleted`).

**New compute modules — `lib/financial/`**
- `sale-snapshot-history.ts` *(pre-existing)* / `return-snapshot-history.ts` **new** — `recordSaleSnapshot` / `recordReturnSnapshot` + `ensureInitial*Snapshot` (lazy backfill of a `created` version before first mutation).
- `sale-snapshot-reporting.ts` *(pre-existing, extended)* — added `computeSnapshotAwareCashCollected`.
- `return-snapshot-reporting.ts` **new** — `computeSnapshotAwareReturnTotals`, `computeSnapshotAwareNetRefunds`, `computeSnapshotAwareReturnFlowsAfter`.
- `cash-position.ts` **new** — derives Cash & Bank = collections − purchases − expenses − net refunds.

**Recording wired into routes**
- Sales: `POST /api/sales` (created), `PATCH`/`PUT`/`DELETE /api/sales/[id]` (settled/edited/deleted). Returns: `POST /api/returns` (created), `PUT`/`DELETE /api/returns/[id]` (edited/deleted).
- **Payments `POST /api/sales/[id]/payments` and PATCH settle are now wrapped in MongoDB transactions** (were bare `findOneAndUpdate`) so a payment can't persist without its snapshot.

**Reporting switched to snapshots**
- `income-statement.ts` — sales + returns now snapshot-aware (formula unchanged).
- `balance-sheet.ts` — added **Cash & Bank** auto line; **weighted-average** inventory cost (was latest-receipt); returns rewind via snapshot deltas; **split equity** into Retained Earnings (prior year-end) + Current Year Earnings; new `inventoryWarnings` for negative reconstructed stock.

**View** — `balance-sheet-view.tsx`: "Compare To" date → muted comparison column + subtotal deltas; inventory-warning amber banner.

**Docs** — updated `context/ui-registry.md` Financial Statements entry (comparison column, warning banner, React Compiler + snapshot-ledger notes).

## Decisions made

- **Snapshot ledger is the source of record for financial statements**; Reports keep reading live records. Same formula, deliberately different data source — documented in `income-statement.ts` header. Do not "reconcile" them by reverting.
- **Cash & Bank is derived, not manual**; owner capital/drawings aren't tracked, so the figure can go negative — surfaced via the Balance Check rather than hidden.
- **Fiscal year = calendar year** (business time) for the retained/current-year split.
- **Inventory valuation = weighted-average purchase cost** of receipts on/before date (replaced latest-receipt-cost).
- Snapshot `store` typed as `string` (not `StoreKey`) in the history helpers — tightening it shifts Mongoose's `create()` overload resolution and surfaces `createdBy`/store generics errors.

## Problems solved

- **React Compiler (React 19/Next 16) forbids manual `useMemo` for derived values** whose inferred deps read nested fields → `react-hooks/preserve-manual-memoization` lint **error**. Fix: compute as a plain value with a module-level helper.
- **AR-corruption bug** (found in review): payment/settle wrote sale + snapshot non-atomically; a failed snapshot write left `ensureInitial`'s stale `created` version, freezing the loan as fully outstanding on backdated sheets. Fixed with transactions.
- Mongoose `findOneAndUpdate` inside a transaction closure: TypeScript won't narrow a captured `let`; used a boxed `{ sale }` result object.
- `tsc --noEmit` shows many errors but the repo sets `ignoreBuildErrors: true`; remaining errors in touched files are the pre-existing `store: string`/`DocumentArray`/`_id` mongoose-generics class, not new logic bugs.

## Current state

- All improvements implemented; **lint clean for touched files**; **build NOT run**; no live verification.
- Working tree has uncommitted changes across sales/returns routes, financial libs, the view, plus untracked `SaleSnapshot.ts`, `ReturnSnapshot.ts`, and the new lib modules. Nothing committed this session.

## Next session starts with

1. **Run `npm run build`** (may need network for font fetching) — the only prescribed check not done.
2. **Live-verify** with `/verify` (dev server + Mongo replica set): create a loan → partial payment → settle; edit then delete a sale/return; confirm a backdated balance sheet's Cash, Inventory (WAC), AR, and equity split stay stable and the Balance Check is sane. Confirm the comparison column + inventory warning render.
3. Consider a **backfill** for pre-ledger sales/returns (statements before the ledger existed rely on live fallbacks; loans settled pre-ledger have no dated payment and are omitted from backdated AR).

## Open questions

- Cash & Bank can read negative until owner capital is entered as a manual item — acceptable, or add a guided "opening capital" prompt?
- Snapshot collections grow one doc per create/edit/payment/delete and reports do full-collection scans — fine now, future perf watch.
- Reports-vs-statements divergence is intentional but unconfirmed by the user as the desired product behavior.
