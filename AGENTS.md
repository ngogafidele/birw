---
description: Instructions for building and maintaining BIRW Inventory
globs: *
alwaysApply: true
---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Read Before Anything Else

Read in this exact order before any implementation:

1. context/project-overview.md
2. context/architecture.md
3. context/ui-tokens.md
4. context/ui-rules.md
5. context/ui-registry.md
6. context/code-standards.md
7. context/library-docs.md
8. context/build-plan.md
9. context/progress-tracker.md

Also read `README.md` and `DOCUMENT.md` when the work touches business behavior, reporting, stock movement, authentication, or PDF output.

## Rules That Never Change

- Preserve single-store scoping. Operational data belongs to `store1` / BIRW INVESTMENT GROUP Ltd.
- Never reduce stock below zero.
- Every sale, return, receipt, stock adjustment, and corrective deletion must keep product quantities and low-stock alerts consistent.
- Paid sales require a payment method. Unpaid sales require customer name, customer phone, and expected payment date.
- Customer loans are unpaid sales, not a separate ledger. Stock leaves when the unpaid sale is recorded, not when payment is collected.
- Keep screen reports and PDF reports aligned when changing financial calculations.
- Use business date helpers from `lib/utils/time.ts` for date inputs, due dates, and report ranges.
- Use `NumberSequence` for generated SKUs, invoice numbers, and proforma numbers. Do not derive document numbers from collection counts.
- Use local UI primitives from `components/ui` and match `context/ui-registry.md` before introducing new visual patterns.
- Update `context/progress-tracker.md` and `context/ui-registry.md` after every meaningful feature or UI pattern change.
- Before any third party library change, read `context/library-docs.md` and the installed package/API documentation when available.
- If the same problem persists after one corrective prompt, stop immediately and run `/recover`.

## Available Skills

- `/architect` - before any complex feature. Think before building.
- `/imprint` - after any new UI component. Capture patterns.
- `/review` - before demo or when something feels off.
- `/recover` - when something breaks after one failed correction.
- `/remember save` - when a feature spans multiple sessions.
- `/remember restore` - when returning after a multi-session feature.

# BIRW Inventory Backend Overview

## What This Project Uses

BIRW Inventory is a Next.js 16 App Router application backed by MongoDB through Mongoose. It uses custom JWT cookie authentication, bcrypt password hashing, Zod request validation, Tailwind CSS 4, local UI primitives, and PDFKit for business documents.

Core backend areas:

- **Database:** MongoDB collections defined in `lib/db/models`
- **Connection:** `connectToDatabase()` in `lib/db/connection.ts`
- **Authentication:** JWT helpers in `lib/auth/session.ts`, current-user validation in `lib/auth/current-user.ts`
- **Authorization:** `requireAuth()` and `requireAdmin()` in `lib/auth/middleware.ts`
- **Server pages:** `requireServerSession()` and `getCurrentStore()` in `lib/auth/server.ts`
- **Validation:** Zod schemas in `lib/db/validators`
- **Documents:** PDFKit generators in `lib/pdf`
- **Store identity:** BIRW company constants in `lib/utils/constants.ts`

## Critical Implementation Order

When implementing a feature, follow this order:

1. Confirm the business workflow in `DOCUMENT.md` and `context/project-overview.md`.
2. Confirm architectural boundaries in `context/architecture.md`.
3. If UI changes are needed, read `context/ui-tokens.md`, `context/ui-rules.md`, and `context/ui-registry.md`.
4. If framework, database, validation, auth, or PDF code changes are needed, read `context/code-standards.md` and `context/library-docs.md`.
5. For Next.js-specific changes, read the relevant installed docs under `node_modules/next/dist/docs/`.
6. Implement the smallest safe change.
7. Verify with the workflow-specific checks listed in `context/progress-tracker.md`.
8. Update context docs if the feature or visual pattern changed.

## Data And Store Rules

All operational records must be scoped to BIRW INVESTMENT GROUP Ltd:

```typescript
const session = await requireServerSession()
const store = getCurrentStore(session)
await connectToDatabase()
const rows = await Model.find({ store })
```

Route handlers must resolve the store from the request:

```typescript
const { authorized, session } = await requireAuth(request)
if (!authorized || !session) {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 },
  )
}

const store = resolveStoreFromRequest(request, session)
if (!store) {
  return NextResponse.json(
    { success: false, error: "Access denied" },
    { status: 403 },
  )
}
```

Do not add multi-store UI or store switching unless the product scope explicitly changes.

## Inventory Rules

The following workflows move stock:

- Product receiving increases stock.
- Sales decrease stock.
- Sale edits reconcile old item quantities against new item quantities.
- Sale deletion restores sold quantities.
- Returns restore returned quantities.
- Stock adjustments add or remove stock with an admin reason.

After inventory changes, synchronize low-stock alerts through `syncLowStockAlert`.

Use MongoDB transactions for multi-write stock operations where the current route already uses them or where partial writes would corrupt inventory.

## Sales And Loans Rules

Paid sale:

- `paymentStatus: "paid"`
- `paymentMethod` is required and must be `cash`, `bank`, or `mobile`
- Customer details are optional

Unpaid sale / loan:

- `paymentStatus: "unpaid"`
- `paymentMethod` must be omitted
- `outstanding.customerName` is required
- `outstanding.customerPhone` is required
- `outstanding.paymentDate` is required
- Stock is deducted immediately

Loan payments update payment history, amount paid, remaining balance, and notifications. They do not change stock.

## Reporting Rules

Reports combine:

- Sales revenue and gross profit
- Returns as reductions to revenue and gross profit
- Expenses as reductions to operating profit
- Inventory cost and retail valuation
- Outstanding unpaid sale balances
- Invoice status totals
- Product movement and recent sales

If changing calculations, update both screen reports and PDF report generation where applicable.

## PDF Rules

PDFs are customer-facing business documents. They must use BIRW INVESTMENT GROUP Ltd identity.

Current PDF areas:

- Sales invoice
- Proforma invoice
- Product catalog
- Outstanding customer statement
- Management report

Use PDFKit only on the server. Keep PDF route handlers on Node runtime when necessary.

## Environment Variables

The application reads:

| Variable | Required For | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Database | MongoDB connection string |
| `JWT_SECRET` | Auth | Signs session cookies |
| `APP_URL` | Password reset email | Public base URL for reset links |
| `RESEND_API_KEY` | Password reset email | Email delivery credential |
| `PASSWORD_RESET_EMAIL_FROM` | Password reset email | Sender address |

Never hardcode or commit secrets.

## Verification Commands

Use these after code changes:

```bash
npm run lint
npm run build
```

Build can require network access for Next font fetching. If a build fails because of sandboxed network access, request approval before retrying with network access.
