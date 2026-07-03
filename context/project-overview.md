# Project Overview

## About The Project

BIRW Inventory is a single-store inventory, sales, invoicing, receivables, and reporting application for BIRW INVESTMENT GROUP Ltd. It supports daily operation for a physical-goods business: product setup, stock receiving, sales, unpaid customer loans, returns, invoices, proformas, expenses, alerts, and management reporting.

The app is implemented as a Next.js 16 App Router application with MongoDB/Mongoose persistence, JWT cookie sessions, Zod validation, Tailwind CSS plus local UI primitives, and PDFKit-generated business documents.

---

## Store Model

The application currently runs as one store only.

| Internal Key | Store | PDF Address |
| --- | --- | --- |
| `store1` | BIRW INVESTMENT GROUP Ltd | KIGALI/GASABO/GISOZI/GAKIRIRO |

All operational records are scoped to `store1`. Store switching helpers exist, but `resolveStoreFromRequest`, `resolveStoreFromValue`, and `getCurrentStore` intentionally resolve to the default store.

Company details used on customer-facing documents:

| Field | Value |
| --- | --- |
| TIN | `129103643` |
| Telephone | `0788229874 / 0788737188` |
| Email | `birwgroup2023@gmail.com` |
| BPR Bank Accounts | `4493574895 (Rwf) / 4493947209 (USD)` |
| MoMo | `0784637231` |

---

## Pages

```text
/                         -> Login page
/setup-admin              -> First admin setup
/reset-password           -> Password reset form
/dashboard                -> Admin overview
/products                 -> Product catalog and stock receiving
/sales                    -> Sales entry, sale edit, sale invoicing
/customers-suppliers      -> Customer and supplier lookup
/returns                  -> Returns and replacements
/invoices                 -> Sales invoices and proformas
/expenses                 -> Operating expenses
/outstanding              -> Unpaid sales, loan collection, statements
/alerts                   -> Low-stock alerts
/stock-adjustments        -> Admin stock corrections
/reports                  -> Admin financial and movement reporting
/users                    -> Admin user management
```

---

## Core User Flow

1. An admin creates the first account from `/setup-admin`.
2. Users sign in from `/` with email or username and password.
3. The authenticated shell wraps all operational pages with the sticky header, sidebar, loan notification button, user badge, and logout action.
4. Staff and managers perform daily product, sales, return, invoice, expense, loan, and alert workflows.
5. Admins additionally access dashboard, reports, users, stock adjustments, correction edits, and destructive actions.

---

## Business Capabilities

- Manage product names, generated SKUs, units, quantities, low-stock thresholds, cost prices, selling prices, and latest supplier receipt context.
- Receive additional stock with supplier name, supplier phone, received date, quantity, unit cost, and total cost.
- Record paid sales through cash, bank, or mobile money.
- Record unpaid sales as loans with customer details and expected payment date.
- Track partial loan payments, remaining balances, due-today loans, and overdue loans.
- Create invoices from sales and proformas from manual or sale-backed item data.
- Download PDFs for invoices, proformas, product catalogs, outstanding statements, and reports.
- Record returns, replacement items, expenses, low-stock alerts, and admin stock adjustments.
- Produce admin reports for revenue, cost of sales, expenses, profit, inventory value, loans, product movement, and recent sales.

---

## Roles And Access

| Role | Access Pattern |
| --- | --- |
| Admin | Full access, including dashboard, reports, users, stock adjustments, product management, and corrective edits/deletes. |
| Manager | Operational workflows, own-sale edits, and invoice management where allowed. |
| Staff | Daily operational workflows and own-sale edits without admin-only management functions. |

JWT sessions carry `userId`, `email`, `role`, `isAdmin`, store context, login log id, and `lastActivityAt`.

Admin idle timeout is 1 hour. Staff and manager idle timeout is 6 hours.

---

## Success Criteria

- Stock never goes below zero.
- Every query and mutation is scoped to the active store.
- Sales, returns, stock receiving, stock adjustments, and sale deletion keep product quantities accurate.
- Paid sales require a payment method.
- Unpaid sales require customer name, customer phone, and payment date.
- Loans remain sales: goods leave stock when issued, not when the loan is collected.
- Report calculations and report PDFs use the same revenue, return, expense, and inventory semantics.
- Customer-facing documents use BIRW INVESTMENT GROUP Ltd identity and address.
