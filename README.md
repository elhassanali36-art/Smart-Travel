# Smart Travel

Bilingual (Arabic RTL / English LTR) travel platform: destinations, local hosts and experiences, explainable matching, trips, bookings, reviews, messaging, notifications, administration.

**Status: NOT PRODUCTION READY. BLOCKED by the build environment (npm registry HTTP 403): dependencies, the database, Jest, builds, HTTP and E2E have never been run here.** See `SMART_TRAVEL_FINAL_RELEASE_AUDIT.md`.

## Stack
Next.js 16 + React + TypeScript (`apps/web`) - NestJS 11 + TypeScript compiled to CommonJS (`apps/api`) - PostgreSQL + Prisma (`prisma/`) - `jose` v5 (CommonJS-compatible) for access tokens - Node `crypto.scrypt` for passwords.

## Requirements
Node.js >= 20.12 (the API loads `.env` with the built-in `process.loadEnvFile`), PostgreSQL 16 (docker compose provided).

## Run
1. `cp .env.example .env` (repo root). Set `JWT_SECRET` (32+ random characters, e.g. `openssl rand -base64 48`) and `SEED_DEMO_PASSWORD` (16+ characters). The API refuses to start with a missing, short or placeholder `JWT_SECRET`, and `DATABASE_URL` is required outside development.
2. `docker compose up -d db`
3. `npm install` (creates the real lockfile; none is committed because installation was impossible here)
4. `npm run db:generate`, then `npx prisma validate`
5. `npx prisma migrate dev --name init` (no migration is committed; never use reset/force-reset on existing data)
6. `npm run db:seed` (refuses to run when `NODE_ENV=production`)
7. `npm run dev` - web http://localhost:3000 (redirects `/` to `/en`), API http://localhost:4000/api/v1/health

## Scripts
`npm run dev | build | start | typecheck | test | test:e2e | db:generate | db:migrate | db:seed | audit:static`.
`npm test` generates the Prisma client and runs the Jest suites of `apps/api` (including real Nest DI wiring and the `jose` CommonJS gate). `npm run test:e2e` runs Playwright (needs the API, database and web app).

## Offline checks (only when packages cannot be installed - NOT a replacement for Jest)
- `npm run check:pure -w apps/api` - dependency-free specs through `scripts/mini-jest.mjs`.
- `npm run check:offline -w apps/api` - service-level specs through `scripts/offline/offline-runner.cjs` (ts-node + stubs of Nest, Prisma, jose, class-validator; needs a global `ts-node`).
- `node scripts/offline/load-all.cjs apps/api/src` - loads every API module with the stubs.
- `npm run test:i18n -w apps/web` - en/ar dictionary parity.

## Accounts and roles
Public registration always creates a TRAVELER. LOCAL_HOST and ADMIN roles are assigned only by an administrator (`PATCH /admin/users/:id/role`, audited). There is no self-service host onboarding and no email/phone verification or password reset yet.
