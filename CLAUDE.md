# CLAUDE.md

Guidance for Claude Code when working in this repository.

> **Heads up — this is Next.js 16, not the Next.js in your training data.** APIs, conventions, and file structure may differ. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework-facing code, and heed deprecation notices.

## Required Reading Before Implementation

`@AGENTS.md` is the canonical, detailed spec. Read it plus the `context/` docs **in this exact order** before any implementation:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ui-tokens.md`
4. `context/ui-rules.md`
5. `context/ui-registry.md`
6. `context/code-standards.md`
7. `context/library-docs.md`
8. `context/build-plan.md`
9. `context/progress-tracker.md`

Also read `README.md` and `DOCUMENT.md` when work touches business behavior, reporting, stock movement, authentication, or PDF output.

## What This Project Is

**BIRW Inventory** — a **single-store** inventory, sales, invoicing, receivables, and reporting app for **BIRW INVESTMENT GROUP Ltd** (internal key `store1`). Daily operations: products, stock receiving, paid sales, customer loans (unpaid sales), returns, invoices, proformas, expenses, low-stock alerts, and admin reporting.

## Stack

- **Next.js 16 App Router** + **React 19** + **Tailwind CSS 4** with local UI primitives (`components/ui`) and `lucide-react`
- **MongoDB / Mongoose** persistence (`lib/db/models`), **Zod** validation (`lib/db/validators`)
- **Custom JWT cookie auth** (`bcrypt`); `proxy.ts` handles request-time session refresh
- **PDFKit** for customer-facing documents — server / Node runtime only (`lib/pdf`)

## Commands

```bash
npm run dev     # local dev server
npm run build   # production build (may need network for Next font fetching)
npm run lint    # eslint
npm run start   # serve production build
```

Run `npm run lint` and `npm run build` after code changes. If a build fails due to sandboxed network access (font fetching), ask before retrying with network access.

## Architecture Patterns

**Server Component page** → authenticate → resolve store → query → serialize → hand to a **client manager** component:

```typescript
const session = await requireServerSession()
const store = getCurrentStore(session)
await connectToDatabase()
const rows = await Model.find({ store }).lean<Row[]>()
return <FeatureManager initialRows={serialized} isAdmin={session.isAdmin} />
```

**API route handler** (`app/api/**/route.ts`):

```typescript
const { authorized, session } = await requireAuth(request) // or requireAdmin()
if (!authorized || !session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

const store = resolveStoreFromRequest(request, session)
if (!store) return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })

const payload = Schema.parse(await request.json())
await connectToDatabase()
// mutate
return NextResponse.json({ success: true, data })
```

All responses use the `{ success, data?, error? }` wrapper. Client managers own form state, dialogs, filtering, pagination, and fetch calls.

## Non-Negotiable Rules

- **Single-store scoping.** Every operational query and mutation resolves and applies `store`. Never add multi-store UI or store switching.
- **Stock never goes below zero.** Every sale, return, receipt, stock adjustment, and corrective deletion keeps product quantities and low-stock alerts consistent. Sync alerts via `syncLowStockAlert`. Use MongoDB transactions for multi-write stock operations.
- **Paid sale:** `paymentStatus: "paid"`, `paymentMethod` required (`cash` | `bank` | `mobile`); customer details optional.
- **Unpaid sale / loan:** `paymentStatus: "unpaid"`, `paymentMethod` omitted; `outstanding.customerName`, `outstanding.customerPhone`, and `outstanding.paymentDate` all required. **Stock leaves when the loan is issued, not when collected.** Loan payments update payment history / amount paid / remaining balance / notifications and **never** move stock.
- **Reports and report PDFs must stay aligned** on revenue, return, expense, and inventory math.
- Use `NumberSequence` for SKUs, invoice numbers, and proforma numbers — **never** derive document numbers from collection counts.
- Use business-date helpers from `lib/utils/time.ts` (`formatInBusinessTime`, `formatBusinessDateInput`, `parseBusinessDateInput`) for date inputs, due dates, and report ranges.
- Use item snapshots on sales, returns, invoices, and proformas so historical records survive product changes.
- Use local UI primitives in `components/ui` and match `context/ui-registry.md` before introducing new visual patterns.
- PDFs use `PDF_COLORS` from `lib/pdf/pdf-theme.ts` and BIRW identity from `lib/utils/constants.ts`.
- Implement the **smallest safe change**, scoped to the requested workflow.

## Inventory Operations That Move Stock

Product receiving (increase), sales (decrease), sale edits (reconcile old vs new quantities), sale deletion (restore), returns (restore), stock adjustments (admin add/remove with reason). Always sync low-stock alerts afterward.

## Roles

| Role | Access |
| --- | --- |
| Admin | Full: dashboard, reports, users, stock adjustments, product management, corrective edits/deletes |
| Manager | Operational workflows incl. invoice management |
| Staff | Daily operational workflows, no admin-only functions |

Admin idle timeout is 1 hour; staff/manager is 6 hours — do not flatten them. The database is the source of truth for active users; inactive users must not retain access.

## Environment Variables

`MONGODB_URI`, `JWT_SECRET`, `APP_URL`, `RESEND_API_KEY`, `PASSWORD_RESET_EMAIL_FROM`. Never hardcode or commit secrets.

## Workflow & Skills

- `/architect` before any complex feature.
- `/imprint` after any new UI component.
- `/review` before a demo or when something feels off.
- `/recover` when something breaks after one failed correction — **if the same problem persists after one corrective prompt, stop and run `/recover`.**
- `/remember save` / `/remember restore` for multi-session features.

Update `context/progress-tracker.md` and `context/ui-registry.md` after every meaningful feature or UI pattern change.
