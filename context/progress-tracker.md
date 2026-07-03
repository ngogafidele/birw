# Progress Tracker

Update this file after meaningful feature work. It should let the next agent see what is implemented and what needs caution.

---

## Current Status

**Phase:** Production maintenance and feature iteration  
**Last documented:** PDF closing thank-you line appears on invoices and statements
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
- [x] Bottom-left PDF BPR bank accounts have enough line width to keep both account numbers on the same line
- [x] Sales invoices, proformas, and outstanding statements include the closing line `Thank you for doing business with us.`

---

## Operational Notes

- `store1` is the only active store. Store helpers intentionally return BIRW INVESTMENT GROUP Ltd.
- Product stock is affected by sales, sale edits, sale deletion, returns, stock receiving, and stock adjustments.
- Staff and managers may edit sales they created; administrators may edit any sale and remain the only role allowed to delete sales.
- Low-stock alerts must stay synchronized after inventory mutations.
- Reports subtract returns from sales revenue and gross profit.
- Unpaid sales are loans; they are not a separate ledger.
- Loan settlement does not alter stock because stock moved when the sale was created.
- Invoice and proforma numbers use `NumberSequence`.
- PDFKit requires Node/server-only execution.
- PDF document styling should use `lib/pdf/pdf-theme.ts` so generated documents stay aligned with the website palette.
- PDFKit only supports JPEG/PNG image embedding in the installed version, so PDF generators intentionally keep `logo.png` and `stamp.jpg` while browser/UI assets can use WebP.
- Invoice, proforma, and outstanding statement store identity blocks should show TIN below email; bottom-left payment details should list only BPR bank accounts and MoMo.
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
