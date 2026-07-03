# BIRW Inventory

BIRW Inventory is a single-store inventory, sales, and receivables
management application for **BIRW INVESTMENT GROUP Ltd**. It supports the daily
operation of a physical-goods business: stock control, direct and credit
sales, returns, invoicing, expenses, alerts, and store-level performance
reporting.

## Business Capabilities

- Manage store-specific products, costs, selling prices, quantities, and low
  stock thresholds.
- Record paid sales through cash, bank, or mobile money.
- Record unpaid sales as customer loans with an expected payment date and
  follow-up statement PDF.
- Process returns and restore returned items to stock.
- Produce sales invoices, proforma invoices, product catalogs, outstanding
  statements, and management reports in PDF format.
- Record operating expenses and calculate store performance.
- Notify users of loans that are due today or overdue.
- Give administrators control of users, stock adjustments, analytics, and
  reports.

## Stores

Application data is isolated by store:

| Internal Key | Store | Document Address |
| --- | --- | --- |
| `store1` | BIRW INVESTMENT GROUP Ltd | KIGALI/GASABO/GISOZI/GAKIRIRO |

Products, sales, returns, invoices, expenses, receivables, alerts, and report
calculations are scoped to BIRW INVESTMENT GROUP Ltd.

## Company Details

| Field | Value |
| --- | --- |
| TIN | `129103643` |
| Telephone | `0788229874 / 0788737188` |
| Email | `birwgroup2023@gmail.com` |
| BPR Bank Accounts | `4493574895 (Rwf) / 4493947209 (USD)` |
| MoMo | `0784637231` |

## Technology

| Area | Implementation |
| --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript |
| Database | MongoDB with Mongoose |
| Input validation | Zod |
| UI | Tailwind CSS and local UI primitives |
| Authentication | JWT session cookie and bcrypt password hashing |
| Documents | PDFKit |
| Icons | Lucide React |

This repository uses the installed Next.js version's documentation in
`node_modules/next/dist/docs/` as the source of truth for framework
conventions.

## Architecture

The application follows the App Router server/client boundary:

- `app/(dashboard)/*/page.tsx` loads authenticated, store-scoped data on the
  server.
- `components/*` contains interactive managers for forms, filters, mutations,
  dialogs, and client refresh behavior.
- `app/api/**/route.ts` implements authenticated mutations, JSON queries, and
  PDF downloads.
- `lib/db/models` defines persisted business records.
- `lib/db/validators` validates API payloads.
- `lib/auth` manages sessions, access checks, and single-store resolution.
- `lib/pdf` renders printable business documents.
- `lib/utils` contains store identity, numbering, formatting, and business time
  handling.

For a detailed functional and technical reference, see [DOCUMENT.md](./DOCUMENT.md).

## Key Workflows

### Sales And Stock

A sale snapshots item name, SKU, unit, cost/base price, selling price, and line
total. Creating a sale decreases store stock. Administrators can edit any sale,
and non-admin users can edit sales they created. Deleting a sale remains an
administrator correction. Editing or deleting a sale reconciles stock so
inventory continues to reflect the recorded transactions.

### Customer Loans

An unpaid sale stores customer and expected-payment details. It remains a sale
for revenue and stock purposes, but appears in the Loans view until payment is
collected. Settling a loan records the payment method and removes outstanding
details. An administrator may delete an unpaid loan, which reverses the sale
and restores its stock.

### Returns

Returns add items back into store stock and reduce revenue and gross profit in
reporting.

### Reporting

Reports combine sales, returns, inventory valuation, expenses, unpaid amounts,
and product movement. Financial dates are interpreted in the configured
business time zone.

## Roles And Access

| Role | Typical Access |
| --- | --- |
| Admin | All operational screens, users, stock adjustments, analytics, reports, correction/deletion actions |
| Manager | Store daily operations and permitted invoice management |
| Staff | Store operational recording and viewing workflows |

All API requests resolve a permitted store from the authenticated session
before accessing operational data.

## Configuration

Create an environment configuration appropriate to the deployment. The
application reads:

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Signs authentication sessions |
| `APP_URL` | Production password reset | Public base URL used in reset links |
| `RESEND_API_KEY` | Password reset email delivery | Resend API credential |
| `PASSWORD_RESET_EMAIL_FROM` | Password reset email delivery | Sender address |

## Development

Install dependencies and run the local server:

```bash
npm install
npm run dev
```

Available commands:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Project Structure

```text
app/
  (dashboard)/       Authenticated operational pages
  api/               JSON and PDF route handlers
components/          Interactive features and UI primitives
lib/
  auth/              Session and permission utilities
  db/                Models, validation, alerts, and database connection
  pdf/               Document generators
  utils/             Shared formatting and store/time utilities
types/               Shared TypeScript contracts
public/              Static assets and branding
```

## Operational Invariants

- Every operational record belongs to a store, and store access must be
  checked before it is read or changed.
- Stock must never be reduced below zero.
- Paid sales store a payment method; unpaid sales store receivable details.
- Loan settlement does not alter stock because stock was deducted when goods
  were issued.
- Deleting a sale that is linked to an invoice is blocked until the invoice is
  addressed.
- Customer-facing PDFs must use BIRW INVESTMENT GROUP Ltd identity.
