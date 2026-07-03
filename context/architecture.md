# Architecture

## Stack

| Layer | Tool | Purpose |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Pages, layouts, route handlers, server rendering |
| UI | React 19, Tailwind CSS 4, local UI primitives, lucide-react | Operational interface |
| Database | MongoDB with Mongoose | Business records and indexes |
| Validation | Zod | API payload validation |
| Authentication | JWT cookie, bcrypt, custom session helpers | Login, idle expiry, route protection |
| Documents | PDFKit | Invoices, proformas, catalogs, statements, reports |
| Email | Resend-compatible password reset helper | Admin password reset emails |

---

## Folder Structure

```text
app/
  (dashboard)/          Authenticated operational pages
  api/                  JSON mutations, queries, and PDF route handlers
  page.tsx              Login page
  setup-admin/          Initial administrator setup
  reset-password/       Password reset UI
components/
  layout/               Authenticated shell, sidebar, loan notifications
  ui/                   Local button, input, select, dialog, table primitives
  products/             Product catalog and receiving workflow
  sales/                Sale entry, edit, invoice creation
  outstanding/          Loan collection and statement workflow
  invoices/             Invoice and proforma managers
  dashboard/            Admin overview cards and summaries
  reports/              Report PDF client action
lib/
  auth/                 Session, permissions, password hashing, current user
  db/models/            Mongoose models
  db/validators/        Zod payload schemas
  pdf/                  PDFKit document generators
  utils/                Time, formatting, constants, numbering, API client
types/                  Shared TypeScript contracts
public/images/          Logo and stamp assets used by UI and PDFs
```

---

## Rendering Boundary

Dashboard pages are Server Components by default. They authenticate through `requireServerSession()`, resolve the single store, connect to MongoDB, query Mongoose models, serialize documents, then pass serializable data into client manager components.

Client manager components own local form state, dialogs, filtering, pagination, optimistic list updates, and fetch calls to route handlers.

---

## API Boundary

Route handlers under `app/api/**/route.ts` follow this pattern:

1. Authenticate with `requireAuth()` or `requireAdmin()`.
2. Resolve the store with `resolveStoreFromRequest()`.
3. Validate request bodies with Zod validators from `lib/db/validators`.
4. Connect to MongoDB through `connectToDatabase()`.
5. Apply Mongoose reads/writes.
6. Return `{ success: boolean, data?: T, error?: string }`.

PDF route handlers use `runtime = "nodejs"` when needed and return binary PDF responses.

---

## Data Model

| Model | Responsibility |
| --- | --- |
| `User` | Role, active status, password hash, store assignment, login timestamps |
| `UserLoginLog` | Login audit and pruning |
| `Product` | Store product master, SKU, unit, quantity, cost, price, thresholds |
| `ProductReceipt` | Supplier receiving records and stock increases |
| `Sale` | Paid and unpaid sales with item snapshots and loan payments |
| `Return` | Returned items and replacement items |
| `Invoice` | Customer invoices from sales or proformas |
| `Proforma` | Quotation documents |
| `Expense` | Store operating expenses |
| `Category` | Product/expense categorization support |
| `StockAdjustment` | Admin stock corrections with reason |
| `Alert` | Low-stock alerts |
| `NumberSequence` | Product SKU, invoice, and proforma numbering |
| `PasswordResetToken` | Hashed password reset tokens and expiry |

---

## Key Data Flows

### Product Creation And Receiving

```text
Products page
  -> ProductsManager
  -> /api/products or /api/products/[id]/receipts
  -> Product / ProductReceipt writes
  -> Low-stock alert sync
```

Product names and SKUs are unique within the store. Product SKU generation uses `NumberSequence`.

### Sale Recording

```text
Sales page
  -> SalesManager
  -> /api/sales
  -> Validate sale payload
  -> Check product availability
  -> MongoDB transaction:
       decrement Product.quantity
       create Sale with item snapshots
  -> Sync low-stock alerts
```

Paid sales require a payment method. Unpaid sales store customer and outstanding payment details.

### Sale Edit Or Delete

Edits reconcile previous sale quantities against next sale quantities. Deletes restore sold quantities. Admin-only corrective deletion is blocked or handled carefully around linked invoices depending on the route behavior.

### Loan Collection

Unpaid sales appear in the Loans view. Payments append to `Sale.payments`, update `amountPaid`, and reduce `remainingBalance`. Fully settled loans stop being outstanding.

### Reporting

Reports aggregate products, sales, returns, invoices, expenses, adjustments, and outstanding unpaid sales for a selected date range. Business dates are parsed and formatted through `lib/utils/time`.

---

## Auth And Session Flow

`proxy.ts` runs for application requests, refreshes valid sessions, and clears expired sessions. Route handlers use request cookies. Server Components use `cookies()` through `requireServerSession()`.

The source of truth for active users is the database. A JWT is accepted only if it verifies, has not idled out, and maps to an active current user.

---

## Invariants

- All operational records are scoped to `store1`.
- Never read or mutate operational data without resolving and applying the store.
- Never reduce stock below zero.
- All inventory-changing operations must sync low-stock alerts.
- Use item snapshots on sales, returns, invoices, and proformas so historical commercial records survive product changes.
- Use `NumberSequence` for generated numbers; do not derive document numbers from counts.
- Use `formatInBusinessTime`, `formatBusinessDateInput`, and `parseBusinessDateInput` for business dates.
- PDF generators must use BIRW INVESTMENT GROUP Ltd identity and document assets from `public/images`.
- Before changing Next.js conventions, read the relevant installed docs in `node_modules/next/dist/docs/`.
