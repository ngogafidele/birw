# Library Docs

Project-specific usage notes for third party libraries in BIRW Inventory.

---

## Next.js

Version: `next@16.2.4`

Rules:

- Read installed docs in `node_modules/next/dist/docs/` before changing routing, caching, route handlers, proxy behavior, metadata, fonts, or server/client boundaries.
- This project uses App Router only.
- `proxy.ts` refreshes app JWT sessions and clears expired sessions.
- Server pages under `app/(dashboard)` should authenticate and fetch data on the server.
- Route handlers under `app/api` are the mutation/query boundary.
- `next.config.ts` sets `images.qualities: [55, 75]` so the auth background can use `quality={55}` while preserving the default 75 quality option.

---

## React

Version: `react@19.2.4`

Rules:

- Server Components are default.
- Use `"use client"` only for managers and primitives that need state, effects, browser APIs, router refresh, or event handlers.
- Keep client managers focused on UI state and fetch calls.

---

## Tailwind CSS And shadcn

Versions: Tailwind CSS 4, `shadcn@4.6.0`

Rules:

- Theme tokens live in `app/globals.css` through `@theme inline`.
- Local primitives are in `components/ui`.
- Do not add a `tailwind.config.ts` just for colors.
- Prefer token utilities like `bg-card`, `border-border`, `text-muted-foreground`, and `bg-primary`.
- Existing code sometimes uses semantic Tailwind palettes for financial/status tints. Match local status patterns instead of inventing a new palette.

---

## Mongoose

Version: `mongoose@9.6.1`

Usage:

- Connection is centralized in `lib/db/connection.ts`.
- Models live in `lib/db/models`.
- Use `connectToDatabase()` before Mongoose operations.
- Use `.lean<T>()` for page data serialization.
- Use sessions/transactions for multi-write inventory operations.
- Define indexes in the schema file for store-scoped lookup and uniqueness.

Rules:

- Always scope operational queries by `store` or `storeId`.
- Do not update product stock without considering low-stock alert sync.
- Do not mutate sales without reconciling stock.

---

## Zod

Version: `zod@4.4.1`

Usage:

- Validators live in `lib/db/validators`.
- Route handlers parse `await request.json()` with the relevant schema.
- Use `.strict()` on structured payloads to reject unexpected fields when adding new schemas.
- Use `.superRefine()` for cross-field business rules, such as paid sales requiring a payment method and unpaid sales requiring outstanding details.

---

## bcrypt

Version: `bcrypt@6.0.0`

Usage:

- Use `hashPassword` and `comparePassword` from `lib/auth/hash.ts`.
- Never compare raw passwords manually.
- Never store plaintext passwords.

---

## jsonwebtoken

Version: `jsonwebtoken@9.0.3`

Usage:

- Session helpers live in `lib/auth/session.ts`.
- `JWT_SECRET` is required at module load.
- Session payloads include role, store context, login log id, and last activity.
- `createToken` uses idle-time based expiry.

Rules:

- Do not add unrelated fields to the JWT unless they are safe and needed on every request.
- Check current user state in MongoDB before accepting a token as active.

---

## PDFKit

Version: `pdfkit@0.18.0`

Usage:

- PDF generation lives in `lib/pdf`.
- PDF document colors are centralized in `lib/pdf/pdf-theme.ts` and mirror the website's light BIRW palette.
- `next.config.ts` marks `pdfkit` in `serverExternalPackages`.
- Generators collect `data` chunks and resolve a `Buffer` on `end`.
- Routes return PDF responses with appropriate content type and disposition.
- Installed PDFKit embeds JPEG and PNG images, not WebP. Keep PDF logo/stamp paths on JPEG/PNG-compatible assets unless a supported conversion layer is added.

Rules:

- Keep PDF code server-only.
- Use the shared `PDF_COLORS` palette instead of per-generator hardcoded brand colors.
- Use Node runtime for PDF route handlers.
- Use store identity constants and shared formatting helpers.
- Keep logo/stamp loading tolerant of missing assets.

---

## lucide-react

Version: `lucide-react@1.14.0`

Usage:

- Sidebar, buttons, status indicators, and auth UI use lucide icons.
- Keep icon sizes consistent with existing classes (`size-4`, `size-5`).

---

## Resend Email

The password reset helper in `lib/email/password-reset.ts` sends reset emails when `RESEND_API_KEY`, `APP_URL`, and `PASSWORD_RESET_EMAIL_FROM` are configured.

Rules:

- Password reset tokens are generated and hashed through `lib/auth/password-reset.ts`.
- Never store raw reset tokens.
- Keep reset links based on `APP_URL`.
