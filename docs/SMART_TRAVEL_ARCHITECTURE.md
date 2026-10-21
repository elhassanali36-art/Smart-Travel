# Smart Travel Architecture

Monorepo: `apps/web` (Next.js) and `apps/api` (NestJS), shared PostgreSQL via Prisma.

Security boundaries: authentication is server-side; roles are read from the database; AI output is untrusted; matching is deterministic and explainable; private account data is not public profile data.

Primary flows: auth → profiles → destinations/experiences → matching → trips → bookings → messaging/notifications → admin/analytics.

## Changes from the deep audit (2026-10-06)
- `apps/api/src/common`: `config-rules.ts` (pure validation), `rate-limiter.ts` (pure) + `rate-limit.guard.ts`, `tx.ts` (`runSerializable`), `security-headers.ts`, `load-env.ts`.
- Pure, framework-free logic extracted so it can be tested without Nest/Prisma: `bookings/booking-rules.ts`, `matching/score.ts`, `profiles/completion.ts`, `auth/password.ts`.
- New model `AuditLog`; new indexes on `Experience.hostProfileId` and `Booking(experienceId, status)`.
- Notifications are created on booking, review and message events (best effort, bilingual text).

## Final hardening changes
- **Auth transport:** `common/cookies.ts` (parse, options, Origin check), `AuthController` sets/clears the refresh cookie; web `lib/api.ts` keeps the access token in memory and performs a single-flight silent refresh.
- **Booking domain:** `bookings/booking-rules.ts` is the single state machine (`evaluate(actor, to, facts, now)`), `bookings/booking-capacity.ts` holds the scheduling math, `BookingsService` applies them inside serializable transactions. Booking has `startsAt`, `endsAt`, `guests`, `expiresAt`, dispute fields; the redundant `Booking.hostProfile` relation was removed (hostId references `User` only).
- **Errors:** `common/prisma-errors.ts` maps known Prisma client errors to 4xx in `HttpErrorFilter`.
- **i18n:** `apps/web/locales/en.ts` and `ar.ts` (Arabic is type-checked against English), `lib/i18n.ts`, `lib/use-i18n.ts`, `lib/errors.ts`; no inline language ternaries remain; parity script `test:i18n`.
- **Host workflow:** `/[locale]/host` (profile, experience CRUD/activation, booking requests) on real endpoints; `GET /experiences/mine` added.
- **Testing seams:** `testing/fake-db.ts` (test double), offline runner and stubs in `scripts/offline`.
