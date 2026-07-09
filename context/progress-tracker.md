# Progress Tracker

Update this file after meaningful feature work. It should let the next agent see what is implemented and what needs caution.

---

## Current Status

**Phase:** Production maintenance and feature iteration  
**Last documented:** Financial Statements (Income Statement + Balance Sheet with versioned manual items and PDF export)
**Next:** Keep context files updated after future feature changes

---

## Implemented

- [x] Login, setup admin, logout, password reset
- [x] JWT session cookie, idle timeout refresh, current-user validation
- [x] Authenticated app shell with role-aware sidebar
- [x] Single-store resolution for BIRW INVESTMENT GROUP Ltd
- [x] Product catalog, SKU generation, receiving, supplier receipt tracking
- [x] Low-stock alert synchronization
- [x] Sales entry, paid/unpaid state, customer capture, admin sale edit/delete, and non-admin edits for sales they created
- [x] Loan/receivable view, partial payments, due and overdue notifications
- [x] Returns with stock restoration and report impact
- [x] Sales invoices and proforma invoices
- [x] PDF generation for invoices, proformas, reports, product catalogs, and outstanding statements
- [x] Expenses and categories
- [x] Dashboard and admin reports
- [x] User management and role controls
- [x] Context documentation mirroring `job_pilot/context`
- [x] Shared UI tokens plus login and setup-admin screens use the BIRW logo-derived green, blue, and gold palette
- [x] Login and setup-admin screens use balanced branded auth layouts with compact operational context and clearer form cards
- [x] Login and setup-admin screens render a local generated inventory/warehouse background through Next image optimization
- [x] Invoice, proforma, product catalog, outstanding statement, and management report PDFs use the shared BIRW website-aligned print palette
- [x] Production build completes after isolating `app/global-error.tsx` from global CSS during `/_global-error` prerender
- [x] Browser-facing logo references use `public/images/logo.webp`; `stamp.webp` is available as a converted stamp asset
- [x] Invoice, proforma, and outstanding statement PDFs show TIN under the store email in the store identity block
- [x] Bottom-left PDF payment/business details on invoices, proformas, and outstanding statements show only BPR bank accounts and MoMo
- [x] PDF table/body rows use smaller text than table headers and titles across invoices, proformas, outstanding statements, product catalog, and management reports
- [x] Admin product "Monitor" action opens a modal reconstructing a product's stock-movement history from receipts, sales, loans, returns, replacements, and adjustments (recharts balance line + by-reason breakdown + event table), with a 30d/90d/1y/all time-range selector; balance is anchored to live quantity via an opening-balance residual (`GET /api/products/[id]/movements`)
- [x] Add Products dialog creates multiple products in one session (repeatable entry rows, add/remove, per-row error reporting); each row posts through the existing single-product endpoint so SKU/receipt/low-stock logic is unchanged; edit remains single-product
- [x] Bottom-left PDF BPR bank accounts have enough line width to keep both account numbers on the same line
- [x] Sales invoices, proformas, and outstanding statements include the closing line `Thank you for doing business with us.`
- [x] Proformas support row-level and document-level discounts (percentage or amount) with server-computed snapshots, live form totals, detail breakdown, and PDF breakdown
- [x] Invoice, proforma, and outstanding statement PDFs order the store identity block as name, TIN, telephone, address, email
- [x] Return update and delete routes reconcile product stock and return records inside MongoDB transactions, with guarded negative-stock updates and post-transaction low-stock alert synchronization
- [x] Reports page no longer renders the bottom Store Summary, Top Moving Products, and Recent Sales tables (charts and metric cards remain); the recent-sales query, its type, and the datetime formatter were removed with them — report math and the management report PDF are unchanged
- [x] Financial Statements section (admin + manager only): Income Statement (fully auto-derived for a date range, math replicates the Reports page) and Balance Sheet (as-of snapshot). Balance sheet auto lines are reconstructed to the date — Inventory Value (stock rewound by post-date movements, valued at latest receipt cost → sale-cost → costPrice fallback), Accounts Receivable (loan totals minus payments on/before date), Retained Earnings (cumulative income statement). Manual balance-sheet items use an append-only versioned model (`BalanceSheetItem`) so edits/deletes are effective-dated and never alter past snapshots. Both statements export to PDF. Balance Check shows the plain assets − (liabilities + equity) difference; no cash is invented

---

## Operational Notes

- `store1` is the only active store. Store helpers intentionally return BIRW INVESTMENT GROUP Ltd.
- Product stock is affected by sales, sale edits, sale deletion, returns, stock receiving, and stock adjustments.
- Staff and managers may edit sales they created; administrators may edit any sale and remain the only role allowed to delete sales.
- Low-stock alerts must stay synchronized after inventory mutations.
- Return edits and deletions must keep product quantity changes and the return record mutation in the same transaction; guarded stock updates prevent concurrent writes from pushing stock below zero.
- Financial Statements are admin + manager only (`requireManagerOrAdmin` on routes, role check + redirect on the page). Income Statement math in `lib/financial/income-statement.ts` must stay identical to the Reports page (revenue net of returns, COGS net of returned-goods cost, sales by `createdAt`, expenses by `date`); this duplication is intentional and must be kept in sync. Balance Sheet reconstructs Inventory Value and Accounts Receivable to the as-of date (no live point-in-time snapshot exists); inventory is valued at latest receipt `unitCost` (sale `basePrice` then `costPrice` fallback). `BalanceSheetItem` is append-only versioned — edits/deletes insert new effective-dated versions; never mutate or hard-delete a version. Existing schemas (`Product`, `Sale`, `Expense`, `ProductReceipt`, `StockAdjustment`, `Return`) are read-only for this feature.
- Reports subtract returns from sales revenue and gross profit.
- Unpaid sales are loans; they are not a separate ledger.
- Loan settlement does not alter stock because stock moved when the sale was created.
- Invoice and proforma numbers use `NumberSequence`.
- PDFKit requires Node/server-only execution.
- PDF document styling should use `lib/pdf/pdf-theme.ts` so generated documents stay aligned with the website palette.
- PDFKit only supports JPEG/PNG image embedding in the installed version, so PDF generators intentionally keep `logo.png` and `stamp.jpg` while browser/UI assets can use WebP.
- Invoice, proforma, and outstanding statement store identity blocks order name, TIN, telephone, address, then email; bottom-left payment details should list only BPR bank accounts and MoMo.
- Proforma discounts: row discounts reduce each line total first (fixed amounts come off the line total, not per unit); the document discount then applies to the discounted subtotal; discounts may never push a line or the document below zero. `computeProformaTotals` in `lib/utils/proforma-totals.ts` is the single source of the math for routes and the client form; stored snapshots keep `lineTotal` net, plus `subtotalAmount` and `discount { type, value, amount }` fields. Discounts are proforma-only; sales invoice PDFs are unaffected.
- PDF titles, section headings, totals, and table headers should remain prominent; data/body rows should stay smaller for visual hierarchy.
- Bottom-left PDF payment details should use a wide text block so BPR bank account numbers do not wrap onto separate lines.
- Sales invoices, proformas, and outstanding statements should close with `Thank you for doing business with us.`
- `app/global-error.tsx` intentionally uses inline BIRW token values instead of importing `app/globals.css`; importing global CSS in the client global-error boundary triggered a Next.js 16.2.4 `workStore` prerender invariant on `/_global-error`.
- Git status may require adding this repo as a safe.directory before git commands work in this environment.

---

## Verification Baseline

Recommended checks after code changes:

```bash
npm run lint
npm run build
```

Workflow checks should match the touched feature:

- Product changes: create/edit/receive/delete product and verify low-stock alerts.
- Sale changes: create paid sale, create unpaid sale, edit sale, delete sale, verify stock.
- Loan changes: collect partial/full payment and refresh notifications.
- Return changes: return items and verify stock plus report calculations.
- Report changes: compare screen report and PDF report.
- Auth changes: login, idle expiry, logout, setup admin, reset password.
