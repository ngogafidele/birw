# UI Registry

Living document for implemented visual patterns. Update this file after creating or materially changing reusable UI or major feature screens.

---

## App Shell

File: `components/layout/app-shell.tsx`

| Property | Pattern |
| --- | --- |
| Shell | `min-h-screen bg-background` |
| Header | `sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur` |
| Header inner | `mx-auto flex max-w-[92rem] ... px-2 py-2 sm:px-3 sm:py-3 lg:px-4` |
| Logo box | `size-12 rounded-xl border border-border bg-white shadow-sm` |
| User badge | `rounded-xl border border-border bg-background px-3 py-2 shadow-sm` |
| Main region | `max-w-[92rem] ... gap-3 px-2 py-2 sm:px-3 sm:py-3 lg:px-4` |
| Content panel | `rounded-2xl border border-border/80 bg-card/95 p-2 shadow-sm backdrop-blur-sm sm:p-3 lg:p-4` |

Pattern notes: The shell is dense and operational. Keep the header sticky and the content area constrained to the existing wide max width.

---

## Sidebar

File: `components/layout/sidebar.tsx`

| Property | Pattern |
| --- | --- |
| Shell | `w-full ... rounded-2xl border border-sidebar-border bg-sidebar/90 p-2 backdrop-blur-sm md:sticky md:top-4 md:h-fit md:w-60` |
| Header | `mb-3 border-b border-sidebar-border px-2 pb-2` |
| Nav grid | `grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:flex md:flex-col` |
| Item | `flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition` |
| Active | `bg-primary text-primary-foreground shadow-sm` |
| Inactive | `text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground` |

Pattern notes: Navigation is role-aware and icon-led. Do not add a second navigation system.

---

## Auth Screens

Files: `app/page.tsx`, `app/setup-admin/page.tsx`, `app/globals.css`
Last updated: 2026-06-23

| Property | Pattern |
| --- | --- |
| Surface | `.brand-auth-surface min-h-screen` |
| Surface palette | `--brand-green: #126a35`, `--brand-blue: #0b7da6`, `--brand-gold: #c99a18` |
| Surface background | Local `next/image` layer using `/images/auth-background.webp`, `fill`, `priority`, `quality={55}`, `sizes="100vw"`, `opacity-52`, plus light green/blue gradient overlays around 22-54% opacity |
| Layout | `grid min-h-screen max-w-6xl items-center gap-6 ... lg:grid-cols-* lg:gap-10` |
| Form card | `rounded-xl border border-border/80 bg-card/95 p-5 shadow-xl backdrop-blur sm:p-7` |
| Logo frame | `rounded-xl border border-[var(--brand-green)]/20 bg-white shadow-sm`, using `/images/logo.webp` |
| Input height | `h-11` |
| Primary button | `bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-deep)]` |
| Setup button | `border-[var(--brand-gold)] bg-[var(--brand-gold)] text-[var(--brand-green-deep)]` |
| Back/login secondary button | `border-[var(--brand-green)]/25 bg-[var(--brand-green)]/10 text-[var(--brand-green-deep)] hover:bg-[var(--brand-green)] hover:text-white` |
| Eyebrow/accent text | `text-[var(--brand-blue-deep)]` |
| Feature icon accent | `text-[var(--brand-blue)]` |
| Supporting cards | `rounded-xl border border-[var(--brand-green)]/20 bg-white/75 p-4 shadow-sm` or `bg-white/80` |
| Setup step strip | `rounded-xl border border-[var(--brand-green)]/20 bg-[var(--brand-green-soft)]/70 p-4` |

Pattern notes: Login and setup-admin are the only screen group that uses the richer branded auth background. The image background is a local generated inventory/warehouse WebP asset, rendered through `next/image` so the runtime serves optimized viewport-sized output instead of a remote request or raw CSS bitmap. Brand logo UI should use `/images/logo.webp`; PDF generators keep JPEG/PNG-compatible image sources because PDFKit does not embed WebP. Keep the form card first on mobile and balanced against concise operational context on desktop. Login uses workflow highlight cards and a first-admin setup callout; setup-admin uses a single compact login escape action in the form header with a visible soft-green background, a setup-step strip, and context cards explaining admin scope. Match the tuned BIRW logo palette: forest green for identity and primary actions, teal-blue for operational icon/eyebrow accents, antique gold only for setup or highlight actions, and soft green-tinted neutrals for modern surfaces.

---

## Page Headers

Files: most `app/(dashboard)/*/page.tsx` and manager components

| Property | Pattern |
| --- | --- |
| Wrapper | `space-y-5` or `space-y-6` |
| Eyebrow | `text-xs uppercase tracking-[0.2em] text-muted-foreground` |
| Title | `text-2xl font-semibold` |
| Helper | `text-sm text-muted-foreground` |

Pattern notes: Keep headings short and functional.

---

## Operational Section Cards

Files: `components/sales/sales-manager.tsx`, reports page, products dialogs

| Property | Pattern |
| --- | --- |
| Shell | `rounded-2xl border border-border bg-card p-4 sm:p-5` |
| Compact shell | `rounded-2xl border border-border/80 bg-card p-4 shadow-sm` |
| Calculated strip | `rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm` |
| Section title | `text-lg font-semibold` |

Pattern notes: Use cards for forms, report sections, and grouped tools. Do not nest decorative cards inside cards.

---

## Tables

Files: `components/ui/table.tsx`, feature managers

| Property | Pattern |
| --- | --- |
| Container | `relative w-full overflow-x-auto` |
| Table | `w-full caption-bottom text-sm` |
| Row | `border-b transition-colors hover:bg-muted/50` |
| Header cell | `h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground` |
| Cell | `p-2 align-middle whitespace-nowrap` |
| Alternating row | `bg-muted/60 hover:bg-muted/70` |
| Empty row | Muted text inside a full-span `TableCell` |

Pattern notes: Feature tables are the primary information surface. Keep them compact and horizontally scrollable.

---

## Buttons

File: `components/ui/button.tsx`

| Variant | Pattern |
| --- | --- |
| Default | `bg-primary text-primary-foreground` |
| Outline | `border-border bg-background hover:bg-muted` |
| Secondary | `bg-secondary text-secondary-foreground` |
| Destructive | `bg-destructive/10 text-destructive hover:bg-destructive/20` |
| Link | `text-primary underline-offset-4 hover:underline` |

Pattern notes: Existing buttons are small by default (`h-8`). Use icons from lucide-react for operational actions.

---

## Products Manager

File: `components/products/products-manager.tsx`

| Property | Pattern |
| --- | --- |
| Toolbar | `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between` |
| Search | `w-full sm:w-56` |
| Dialog fields | `grid gap-3`, `grid gap-3 sm:grid-cols-2` |
| Warning text | `text-xs text-amber-600` |
| Low badge | `rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700` |
| Below cost badge | `rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700` |
| Add dialog (create) | Widened `sm:max-w-2xl max-h-[90vh] overflow-y-auto`; repeatable entry cards `grid gap-3 rounded-xl border border-border p-3` with a `Product N` header + ghost `Trash2` remove, an outline `Add another product` button, and a per-row `_error` line |
| Edit dialog | Single entry, default dialog width, no supplier fields |
| Shared fields | `ProductFields` renders the Name/Unit/Quantity/Threshold/Cost/Selling grid (+ optional supplier) for both edit and each create row |

Pattern notes: Products combines catalog scanning, PDF export, admin create/edit/delete, receiving, and stock monitoring in one manager. The admin Actions cell orders Monitor, Receive, Edit, Delete. The Add dialog creates multiple products in one session: each row is submitted through the single-product `POST /api/products` endpoint (so SKU generation, supplier receipts, and low-stock sync stay identical), successful rows prepend to the list, and failed rows stay in the dialog with their own error so the user can fix and resubmit only those.

---

## Sales Manager

File: `components/sales/sales-manager.tsx`

| Property | Pattern |
| --- | --- |
| Sale form card | `space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5` |
| Line item grid | `grid gap-3 rounded-lg border border-border/80 p-3` |
| Total strip | `rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm` |
| Paid badge | Emerald border/background/text tint |
| Unpaid badge | Amber border/background/text tint |
| Below cost alert | `inline-flex ... border border-destructive/30 bg-destructive/10 ... text-destructive` |

Pattern notes: Sales is a high-risk workflow. UI changes must preserve stock validation, customer/loan requirements, and edit reconciliation.

---

## Reports

File: `app/(dashboard)/reports/page.tsx`

| Property | Pattern |
| --- | --- |
| Filter form | `grid gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[1fr_1fr_auto_auto]` |
| Metric cards | `rounded-2xl border p-4 shadow-sm` with semantic color tint |
| Report sections | `space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm` |

Pattern notes: Reports use more color than daily operation screens to distinguish financial categories.

---

## Global Error Boundary

File: `app/global-error.tsx`
Last updated: 2026-07-02

| Property | Pattern |
| --- | --- |
| Page background | Inline BIRW background token value `#f6faf6` |
| Card background | Inline card token value `#ffffff` |
| Border | Inline border token value `#d3e3d7` |
| Border radius | Inline value matching `rounded-2xl` scale |
| Text - primary | Inline foreground token value `#102017`, `1.5rem` heading |
| Text - secondary | Inline muted token value `#55665b`, `0.875rem` body |
| Eyebrow text | Inline muted token value, uppercase, `0.2em` letter spacing |
| Spacing | Inline equivalents of `px-4`, `p-6`, `mt-2`, `mt-3`, `mt-5` |
| Hover state | none |
| Shadow | Inline equivalent of `shadow-sm` |
| Accent usage | Inline primary token value `#126a35` with white retry action text |

Pattern notes: The global error fallback uses the same visual token values as the authenticated app while avoiding a direct `app/globals.css` import. In Next.js 16.2.4, importing global CSS from this client fallback triggered the production prerender invariant `Expected workStore to be initialized` for `/_global-error`. Keep this screen self-contained, calm, and operational; it replaces the root layout when active and must include its own `<html>` and `<body>` shell.

---

## PDF Documents

Files: `lib/pdf/*.ts`, `lib/pdf/pdf-theme.ts`
Last updated: 2026-06-24

| Property | Pattern |
| --- | --- |
| Palette source | Shared `PDF_COLORS` constants derived from the light website/auth palette |
| Primary text | `#102017` |
| Muted text | Print-dark muted green `#33443a` |
| Header text | Deep BIRW green `#063f20` |
| Section/table label text | BIRW teal-blue `#075b78` |
| Accent rule | BIRW gold `#c99a18` |
| Table header fill | Soft green `#eaf5ec` |
| Table headers | Uppercase labels with `NO` numbering columns where row/transaction tables are listed |
| Table body rows | Smaller bold text than headers/titles for print hierarchy; white alternating with light green-tinted `#f6faf6` |
| Borders/rules | Token border green `#d3e3d7` |
| Store identity block | Store name, then TIN, telephone, address, and email in that order |
| Payment detail footer | Bottom-left details list only BPR bank accounts and MoMo; width keeps both BPR accounts on one line |
| Closing line | Sales invoices, proformas, and outstanding statements use `Thank you for doing business with us.` |

Pattern notes: Customer-facing and management PDFs should use `PDF_COLORS` instead of local hardcoded print palettes. Keep invoice, proforma, product catalog, outstanding statement, and management report colors aligned with the website palette while preserving print-safe contrast. Table title rows use uppercase labels, row/transaction tables include a `NO` column, the store identity block orders name, TIN, telephone, address, then email, bottom-left payment details stay limited to payment identifiers, and PDF text uses bold built-in fonts with darker muted text so printed documents remain legible. Proforma PDFs render row discounts as a muted sub-line under the item description (`Discount 10%: -1,000 Rwf`) and, when a document discount exists, a Subtotal / Discount / Total block above the grand total.

Financial statement PDFs (`lib/pdf/financial-statement-generator.ts`) render every figure inside a fully bordered grid: a `DESCRIPTION | AMOUNT` header band (`tableHeader` fill, uppercase `sectionText` labels), a `border`-green outer box + per-row separators + a vertical label/amount divider at x=372, alternating `rowAlt` tint on data rows, and total rows that add a heavier top rule (`text` weight, or gold `accent` on the final figure — Net Profit, Total Liabilities + Equity) plus a soft `tableHeader` fill. The Income Statement is one table; the Balance Sheet is one bordered table per section (Assets / Liabilities / Equity), with line groups (Current/Fixed, etc.) drawn as full-width `neutralFill` band rows and manual-item notes as an 8pt muted sub-line inside the cell. PDFKit's built-in Helvetica is WinAnsi-encoded and cannot render the Unicode minus (U+2212) or en/em dashes — `sanitizeText` normalizes them to a hyphen before every label/note is drawn, so figures stay legible.

---

## Proforma Discounts

Files: `components/invoices/proforma-list.tsx`, `lib/utils/proforma-totals.ts`
Last updated: 2026-07-04

| Property | Pattern |
| --- | --- |
| Discount type field | Local `Select` with options No discount / Percentage (%) / Amount (Rwf) |
| Discount value field | `Input type="number" min="0"`, `max="100"` for percentage, shown only when a type is selected |
| Row discount placement | Extra `grid gap-3 sm:grid-cols-3` row inside each item card |
| Document discount block | `grid gap-3 rounded-lg border border-border p-3` section below the items list |
| Totals strip | `rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm` with Subtotal, optional Document discount, and bold Total rows |
| Detail view | Per-line muted `(discount ...)` note plus a muted Subtotal / Document discount / Total strip when a document discount exists |

Pattern notes: All discount math lives in `computeProformaTotals` (`lib/utils/proforma-totals.ts`), shared by the API routes and the client form so live totals always match server results. Row discounts apply to the line total first; the document discount applies to the discounted subtotal; nothing may go below zero.

---

## Product Stock Monitor

Files: `components/products/product-monitor-dialog.tsx`, `components/products/stock-movement-charts.tsx`, `app/api/products/[id]/movements/route.ts`
Last updated: 2026-07-04

| Property | Pattern |
| --- | --- |
| Trigger | Admin-only `Monitor` button (lucide `Activity`) as the first item in the products Actions cell |
| Modal | `DialogContent` widened to `max-h-[90vh] gap-4 overflow-y-auto sm:max-w-3xl` |
| Range selector | Row of `Button size="sm"` chips (30 days / 90 days / 1 year / All time); active uses `variant="default"`, others `outline` |
| Stat tiles | `grid grid-cols-2 gap-3 sm:grid-cols-4`; each `rounded-xl border border-border bg-card p-3` with uppercase eyebrow + `text-lg font-semibold` value (Opening / Total in / Total out / Current) |
| Chart cards | `rounded-xl border border-border bg-card p-3` wrapping a recharts `ResponsiveContainer height={240}` |
| Balance chart | `AreaChart` `type="stepAfter"`, fill gradient on `var(--chart-1)`; anchored to live quantity via opening-balance point |
| Breakdown chart | `BarChart` with per-`Cell` fill: in = `var(--chart-1)`, out = `var(--chart-2)`; legend dots below |
| Axis/tooltip | Ticks `fill: var(--muted-foreground)`; tooltip `bg var(--popover)`, `border var(--border)`, radius 12 |
| Event table | Reuses the local `Table`; movement badge in = `bg-emerald-50 text-emerald-700`, out = `bg-rose-50 text-rose-700`; signed change column in emerald/rose |

Pattern notes: The modal is read-only and admin-only. The API (`GET /api/products/[id]/movements`) reconstructs history by merging `ProductReceipt` (in), `Return.returnItems` (in) / `replacementItems` (out), `Sale.items` incl. loans (out), and `StockAdjustment` (±), then anchors the running balance to the true `product.quantity`, surfacing any residual as an "Opening" baseline. Time ranges are derived entirely client-side from the full history (no refetch); a bounded range recomputes its own opening balance, totals, breakdown, and series so the numbers stay honest. Chart colors must stay on the `--chart-*` tokens; do not hardcode hex chart colors.

---

## Financial Statements

Files: `components/financial-statements/financial-statements-manager.tsx`, `income-statement-view.tsx`, `balance-sheet-view.tsx`, `app/(dashboard)/financial-statements/page.tsx`
Last updated: 2026-07-17

| Property | Pattern |
| --- | --- |
| Access | Admin + manager only; sidebar item (lucide `FileSpreadsheet`) and page redirect staff to `/sales`; routes use `requireManagerOrAdmin` |
| Tab toggle | `inline-flex rounded-xl border border-border/80 bg-card p-1`; each tab a `<button>` `rounded-lg px-4 py-2 text-sm font-medium`; active `bg-primary text-primary-foreground shadow-sm` (no Tabs primitive exists — use button state) |
| Controls bar | `flex flex-wrap items-end gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm`; date inputs are `<label className="grid gap-1 text-sm">` wrapping an `Input type="date"`; date presets are `Button size="sm" variant="outline"`; `Produce` primary; `Download PDF` `variant="outline"` (opens the `/pdf` route in a new tab) |
| Statement rows | `<dl>` with `divide-y divide-border/70`; line rows muted label, subtotal `font-medium`, total `border-t-2 border-border text-base font-semibold` with emerald/rose value by sign |
| Balance Check card | `rounded-2xl border p-4`; balanced (rounded diff = 0) uses `border-emerald-200 bg-emerald-50`, otherwise `border-amber-200 bg-amber-50`; shows the plain signed difference (never force-reconciled) |
| Warning banner | Data-quality alerts (e.g. inventory reconstruction went negative) reuse the amber treatment: `rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950` with a `font-medium` heading line — same palette as the unbalanced Balance Check |
| Balance sheet layout | `grid gap-4 lg:grid-cols-2`; Assets in the left card, Liabilities + Equity stacked right; `Subtotal` = `border-t border-border pt-2 text-sm font-medium` |
| Comparison column | Optional "Compare To" date renders a second, muted figure inline before each amount: comparison value in `text-muted-foreground`, primary amount in normal weight; missing comparison line shows `—`. Subtotal deltas are `text-xs font-normal` colored `text-emerald-600` (≥0, `+`-prefixed) or `text-rose-600` (<0). A `text-xs text-muted-foreground` caption states which date is muted and the delta direction |
| Manual item CRUD | `Add Item` opens a `Dialog`; category via `Select` with `SelectGroup`/`SelectLabel` (Assets / Liabilities / Equity); inline `Pencil` / `Trash2` `Button size="icon-xs" variant="ghost"` on manual lines only; delete confirmed with `window.confirm` |

Pattern notes: Views fetch from `/api/financial-statements/*` client-side; the initial load runs in an effect that only sets state **after** the await (state is initialized `loading: true`) to satisfy the `react-hooks/set-state-in-effect` rule — do not call `setState` synchronously in these effects. This project runs the **React Compiler** (React 19 / Next 16) — do **not** add manual `useMemo`/`useCallback` for derived render values; compute them as plain values (a manual `useMemo` whose inferred deps read nested fields trips `react-hooks/preserve-manual-memoization` and fails lint). Income statement math lives in `lib/financial/income-statement.ts` and must stay identical to the Reports page **formula**, but financial statements deliberately read the immutable sale/return **snapshot ledger** (`lib/financial/sale-snapshot-reporting.ts`, `return-snapshot-reporting.ts`) so issued statements stay stable after later corrections, whereas Reports read live records. Manual balance sheet items are an append-only version history (`BalanceSheetItem`): edits/deletes write new effective-dated versions so past snapshots never change. Balance sheet auto lines now include a derived **Cash & Bank** position (`lib/financial/cash-position.ts`) and split equity into Retained Earnings (prior year-end) + Current Year Earnings.
