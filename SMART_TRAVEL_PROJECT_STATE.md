# SMART TRAVEL - PROJECT STATE

## CHECKPOINT: Final hardening & release-blocker audit (2026-10-08) - NOT PRODUCTION READY - BLOCKED
- Resolved in code: jose/CommonJS (pinned v5), ambiguous Booking relation (removed), Jest/ts-jest/@types versions, scripts and tool declarations, token storage (memory + HttpOnly cookie, Origin check), booking schedule/guests/per-slot capacity, central state machine with expiry (lazy) and disputes, host dashboard, en/ar dictionaries, Prisma error mapping.
- Executed here (NOT Jest; stand-ins for missing packages): 60 + 75 tests (128 unique) passing; load-all 71/71 modules; strict tsc on dependency-free modules; i18n parity 198 keys / 161 references; static-audit 28/28 (original upload: 8/28); git diff --check clean.
- BLOCKED: npm install/audit/outdated (registry HTTP 403), Prisma validate/generate/migrate/seed, PostgreSQL, real Jest (incl. DI wiring, jose gate, admin metadata, DTO validation), builds, HTTP smoke, Playwright. No lockfile and no migration exist.
- Open debt: admin-assigned host role, no expiry scheduler, no payments, no email/phone verification or password reset, process-local rate limiting, no web security headers, messaging without conversations.
- Full details: SMART_TRAVEL_FINAL_RELEASE_AUDIT.md. Exact next action is at the end of that file.
- GIT: final commit 20d2f0c on top of 194fd5a (hardening), 8453c3f (previous audit) and 397f299 (baseline of the upload); history not rewritten.

---
# Earlier checkpoints (history)

# SMART TRAVEL — PROJECT STATE

## CHECKPOINT: Deep audit & repair (2026-10-07) — PARTIAL / BLOCKED BY ENVIRONMENT
- Audit status: second audit complete. Files inspected: 100/100 (81 TS/TSX). Modified: 79 files (62 M, 16 A, 1 D). Defects found: 36 (1 critical, 16 high, 17 medium, 2 low). Defects fixed in source: 36. Open: the debt in SMART_TRAVEL_DEEP_AUDIT_REPORT.md section 19-20.
- Runtime evidence: 41 custom tests PASS (scripts/mini-jest.mjs, not Jest); strict tsc PASS on dependency-free modules and web/lib/api.ts; syntax parse PASS (95 files); static-audit 18/18 PASS.
- BLOCKED: npm install/audit, Jest, nest/next build, prisma generate/validate/migrate (no migrations exist), HTTP integration, E2E. Registry returns HTTP 403.
- NOT production ready.
- New in code: rate limiting (in-memory), secure headers, `.env` loading, serializable booking/admin transactions, AuditLog, notifications on events, traveler-only reviews, pagination caps, DTO bounds, public data allow-lists.
- Exact next action: see report section 22.

---
# Previous state (kept for history; "PASS" lines below were produced by heuristic scripts, not by the checks named, and are not evidence)

# SMART TRAVEL PROJECT STATE

## Post-Audit Checkpoint — 2026-10-06

The Smart Travel greenfield project was subjected to a second deep static/code audit after the initial local build.
The audit was performed file-by-file with TypeScript parser checks, JSON parsing, schema/relation inspection, authorization-flow inspection, API/DTO inspection, and feature-surface comparison.

## Architecture
- `apps/web`: Next.js/React/TypeScript bilingual web app.
- `apps/api`: NestJS/TypeScript REST API.
- `prisma`: PostgreSQL schema and seed.
- `docker-compose.yml`: PostgreSQL 17 local service.

## Implemented domains
- Arabic RTL / English LTR web shell and localized user flows.
- Registration/login/refresh/logout/current-user authentication foundation.
- Node crypto.scrypt password hashing with per-password random salts.
- Opaque hashed rotating refresh tokens with atomic old-token consumption and replay revocation.
- Database-backed role/status authorization: TRAVELER, LOCAL_HOST, ADMIN.
- Traveler and local-host profiles with deterministic completion scoring.
- Destinations/discovery and local experiences.
- Deterministic explainable host matching (0–100).
- Server-side AI provider abstraction with deterministic fallback; AI output is not trusted for authorization.
- Trip creation/update plus itinerary item create/update/delete with ownership checks.
- Booking creation/listing and actor-specific booking state transitions.
- Booking capacity guard for active requests/accepted/confirmed bookings.
- Reviews with one-review-per-booking enforcement.
- Messaging with recipient validation and sender/recipient relations.
- Notifications and read-state updates.
- User reporting with reported-user referential integrity.
- Protected admin overview/user/status/role/host-verification/report controls.
- Analytics summary.
- Web surfaces for discovery, profiles, matching, trips/itinerary, bookings, messages, notifications, AI assistant and admin overview/user controls.
- Automatic browser-side access-token refresh using the rotating refresh-token endpoint.

## Important fixes discovered during deep audit
1. Health endpoint was accidentally protected by the global auth guard. It is now explicitly public.
2. Development database behavior was inconsistent with the documented optional-development configuration. Prisma now skips connection on startup only when development has no `DATABASE_URL`; health reports `unconfigured`.
3. Multiple feature modules were independently providing `PrismaService`, which could create multiple Prisma client/pool instances. A global `CommonModule` now owns `ConfigService` and `PrismaService`.
4. Prisma `Message.recipient` relation was missing. The schema now has sender and recipient relations.
5. `ItineraryItem.experienceId` was an unreferenced scalar. It now has a nullable relation to `Experience`.
6. `Report.subjectUserId` was an unreferenced scalar. It now has a nullable relation to `User`.
7. Profile `me` used `include` and `select` together in one Prisma query. It now uses a valid `select` shape.
8. Booking status transitions were not actor-specific. Travelers could perform host actions and hosts could perform traveler actions. The state machine is now role-aware.
9. Booking creation did not verify traveler role or trip ownership. Both are now enforced.
10. Booking creation now checks experience capacity against active bookings.
11. Experience and trip update endpoints used `Partial<DTO>`/runtime-object typing, creating a mass-assignment risk. Dedicated validated update DTOs are now used.
12. Several raw request bodies lacked DTO validation. AI, messaging, reports, reviews and admin mutation inputs now use validated DTOs.
13. UUID path parameters are validated with `ParseUUIDPipe` on relevant resources.
14. Admin user mutations could return `passwordHash`. Admin responses now explicitly select safe fields.
15. The last active administrator could be removed/deactivated. Guards now prevent lockout of the last active administrator.
16. Seed reruns could create duplicate demo experiences. Seed now checks before creating the demo experience.
17. Seed no longer contains a hardcoded demo password; it requires `SEED_DEMO_PASSWORD`.
18. Browser API access now retries one 401 through refresh-token rotation and then retries the original request once.
19. Public profile responses now explicitly whitelist public fields instead of returning the complete profile records.
20. Itinerary CRUD is now backed by real API endpoints and ownership checks.

## Verification
- TypeScript parser audit: PASS — 81 `.ts`/`.tsx` files, 0 parse errors.
- JSON parsing audit: PASS — 6 JSON files, 0 parse errors.
- Static security/integrity audit: PASS.
- Required API-domain surface audit: PASS.
- Hardcoded-secret pattern audit: PASS — 0 findings.
- Destructive-command audit: PASS — 0 source references.
- Partial DTO/mass-assignment pattern audit: PASS — 0 `Partial<...Dto>` references.
- Duplicate Prisma provider audit: PASS — only `CommonModule` owns `PrismaService`/`ConfigService`.
- Health public check: PASS by source inspection.
- Message relation check: PASS by schema inspection.
- Itinerary experience relation check: PASS by schema inspection.
- Report subject relation check: PASS by schema inspection.
- Booking actor-rule check: PASS by source inspection.
- Trip ownership check: PASS by source inspection.
- Refresh-token atomic-consumption check: PASS by source inspection.

## Runtime verification status
The following could NOT be honestly marked PASS because dependencies were not available in the environment:
- `npm install`: BLOCKED/TIMED OUT online; offline installation returned `ENOTCACHED`.
- TypeScript project typecheck: BLOCKED by missing installed dependencies/generated Prisma client.
- Nest build: BLOCKED by missing dependencies.
- Next.js build: BLOCKED by missing dependencies.
- Prisma generate/validate/migrate: BLOCKED by missing Prisma CLI/client and no PostgreSQL runtime.
- Jest: NOT RUN because dependencies are unavailable.
- HTTP integration: NOT TESTED.
- PostgreSQL integration: NOT TESTED.
- Playwright E2E: NOT TESTED.

## Known production/security work remaining
- Rate limiting and brute-force protection.
- Email/phone verification.
- Password reset/recovery.
- Secure headers/CSP review.
- Production media storage and upload scanning.
- Payment/monetization provider integration.
- External AI provider integration if desired; deterministic fallback remains available.
- Full admin workflow UI for reports/verification/experience operations.
- Full host experience management UI.
- Full review/report UI surfaces.
- Production observability, request IDs and structured operational logging.
- Real dependency vulnerability audit.
- Real database migration generated by Prisma.
- Real Jest/integration/E2E execution.

## Security status
The project is **NOT CLAIMED PRODUCTION-READY**. Runtime verification is still blocked. No runtime PASS is fabricated.

## Exact continuation point
On a networked development machine:
1. `npm install`
2. set a real `JWT_SECRET` and `SEED_DEMO_PASSWORD`
3. `npm run db:generate`
4. `npm run typecheck`
5. `npm test`
6. `npm run build`
7. `docker compose up -d db`
8. `npx prisma validate`
9. `npx prisma migrate dev --name init`
10. `npm run db:seed`
11. run HTTP smoke tests for auth, profiles, discovery, matching, trips/itinerary, booking transitions, messages, notifications, reports and admin authorization
12. run Playwright E2E
13. fix any runtime/type/build findings before production deployment
