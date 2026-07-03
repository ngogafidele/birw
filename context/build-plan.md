# Build Plan

This file describes the implemented product areas and the safest order for future work. BIRW Inventory is already a functional application; new work should preserve existing operational behavior instead of treating this as a greenfield plan.

---

## Principle

For every feature, start from the real business invariant:

- What store does it affect?
- Does it move stock?
- Does it affect revenue, profit, expenses, receivables, or reports?
- Does it need a PDF or customer-facing document?
- Which roles are allowed to perform the action?

Build UI and data changes together only when the workflow can be verified end to end.

---

## Implemented Areas

### 01 Authentication And Setup

- Login page
- Setup admin page
- Logout
- Password reset request and reset form
- JWT cookie sessions
- Idle timeout refresh through `proxy.ts`
- Active-user verification from MongoDB

### 02 Authenticated Shell

- Sticky header with logo, user badge, loan notifications, logout
- Role-aware sidebar
- Main content card shell
- Admin and staff navigation differences

### 03 Product Catalog And Receiving

- Product list, search, pagination
- Admin create/edit/delete
- Generated SKU sequence
- Cost price, selling price, low-stock threshold
- Supplier receipt workflow
- Product catalog PDF
- Low-stock alert synchronization

### 04 Sales And Stock Movement

- Multi-line sale entry
- Paid and unpaid sale flows
- Customer capture
- Admin cost price override
- Stock availability checks
- Sale edit with stock reconciliation
- Admin sale deletion with stock restoration
- Create invoice from sale

### 05 Customer Loans

- Unpaid sales list
- Expected payment dates
- Due/overdue notifications
- Partial and full payment collection
- Outstanding customer statement PDF
- Admin correction actions

### 06 Returns

- Returned item capture
- Replacement item support
- Stock restoration
- Revenue and profit reduction in reports

### 07 Invoices And Proformas

- Sales invoice list and management
- Proforma list and management
- Per-store monthly numbering
- PDF downloads
- Invoice status handling

### 08 Expenses

- Store-level operating expense entry
- Payment method capture
- Category support
- Report integration

### 09 Alerts

- Low-stock alerts
- Alert synchronization after product and inventory mutations
- Alert management routes

### 10 Reports And Dashboard

- Admin dashboard stats
- Date-range reports
- Product movement
- Recent sales
- Inventory valuation
- Loans, invoices, expenses, revenue, cost of sales, and profit
- Report PDF

### 11 User Management

- Admin user create/update/delete
- Role and active status management
- User login log model

---

## Future Work Order

When adding substantial new work, prefer this sequence:

1. Update or add data model fields and validators.
2. Update route handlers with auth, store scoping, validation, and safe errors.
3. Update Server Component data loading and serialization.
4. Update client manager UI.
5. Update report/PDF calculations if the workflow affects financials.
6. Update `context/progress-tracker.md` and `context/ui-registry.md`.
7. Verify lint/build and the relevant workflow manually.

---

## High-Risk Areas

- Sale edit and delete
- Return handling
- Loan payment settlement
- Product receiving and stock adjustments
- Report profit calculations
- Invoice/proforma numbering
- Auth/session/proxy changes
- PDF generation in production runtime

Treat these areas as requiring extra reading and verification.
