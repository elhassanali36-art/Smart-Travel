> **Status update (2026-10-08):** later hardening resolved several items listed below as risks or debt: jose/CommonJS (pinned v5), the double `Booking.hostId` relation (removed), booking date/guests/capacity, EXPIRED/DISPUTED reachability, host dashboard, translation dictionaries, token storage (HttpOnly cookie) and rate-limit documentation. Current evidence and the remaining blockers are in `SMART_TRAVEL_FINAL_RELEASE_AUDIT.md`. The text below is kept as history.

# SMART TRAVEL — DEEP AUDIT REPORT (second audit)

**1. Audit date:** 2026-10-07. **Subject:** `smart-travel-audited-fixed.zip` exactly as uploaded (baseline commit `397f299`, created by this audit; the zip contained no Git history).
**Method:** every source, config, schema, seed, script and documentation file was read in full; defects were fixed in place; the audit was then repeated (syntax parse, strict typechecks, runtime checks, grep audits, diff review). Earlier reports were not trusted.

## Final audit status: **PARTIAL / BLOCKED BY ENVIRONMENT**
Not production ready. The npm registry returns HTTP 403 (checked again at the start of this audit), so nothing that needs installed packages could run: no `npm install`, `tsc` on Nest/Next files, Jest, `prisma generate/validate/migrate`, `nest build`, `next build`, HTTP integration or E2E.

## 2. Files inspected
100 files in the upload (81 TS/TSX, Prisma schema, seed, configs, docs, scripts). 100% were read.

## 3. Files modified
79 changed versus the baseline: 62 modified, 16 added, 1 removed (`apps/web/app/page.tsx`). `git diff 397f299` is provided as `smart-travel-audit.patch`.

## 4-12. Defects found and repaired
Severity: C critical, H high, M medium, L low. Evidence: **[R]** reproduced by an executed test or script here, **[S]** confirmed by reading the code (cannot run without dependencies), **[U]** unverified risk (not changed or changed defensively).

| ID | Sev | Area | Defect and mechanism | Repair | Evidence |
|---|---|---|---|---|---|
| D1 | C | Privacy | Public `GET /destinations/:id` used `include: { host: { include: { user: true } } }`, returning every host's full user row (**passwordHash, email, phone**) to unauthenticated callers. | `select` of `{id, city, country, verification, user:{id,name}}`; only ACTIVE hosts; 404 when missing. | S; static-audit check fails on baseline |
| D2 | H | Web/API contract | Register form always sent `email:""` and `phone:""`; `@IsOptional()` does not skip empty strings, so every email-only or phone-only registration failed with 400. | Client omits blank fields; DTO `@Transform` treats blank as absent (login too). | S |
| D3 | H | Web/API contract | Profile page PUT the whole stored profile (id, userId, completion, timestamps); `forbidNonWhitelisted` rejected it, so every save after the first failed. | Sends only editable fields; added languages/interests inputs. | S |
| D4 | H | Auth | `verifyAccess` returned the full User (incl. passwordHash) as `req.user`; any handler returning it would leak the hash. | Explicit `select {id,name,role,status}`; typed `SafeUser`/`AuthedRequest` replaces `req:any`. | S; static-audit |
| D5 | H | Concurrency | Booking capacity check and insert were separate queries (overbooking under concurrency). | Serializable transaction with bounded retry (`runSerializable`); open-booking duplicate check; host user must be ACTIVE. | S |
| D6 | H | Concurrency | Booking transitions updated `where {id}` after validating a stale status (lost updates, e.g. accept vs cancel). | Conditional `updateMany where {id,status}`; 409 on conflict; notifications to the counterpart. | S |
| D7 | H | Ops | The API never loaded `.env` (no dotenv/@nestjs/config) so the README flow failed on the missing `JWT_SECRET`. | `common/load-env.ts` using `process.loadEnvFile`; `engines.node >=22.12`. | S |
| D8 | H | Tooling | `@nestjs/cli` was not a dependency, so `nest build/start` could not run. | Added `@nestjs/cli`, `@types/node`; removed unused `@nestjs/jwt`. | S |
| D9 | H | Tooling | `npm test` could not pass: zero test files and no Jest config. | Jest config + 6 spec files (41 tests). | R |
| D10 | H | Messaging | `orderBy createdAt asc` + `take 200` returned the OLDEST 200 messages; newer ones disappeared. | Newest 200 (desc) then reversed; deterministic tie-break. | S |
| D11 | H | Privacy | Hosts received the traveler's full `trip` (title, dates, private preferences) in `GET /bookings`. | Trip included for travelers (and admin) only. | S |
| D12 | H | Privacy | `GET /profiles/:id` exposed suspended/disabled users and admins, inactive experiences (all columns) and raw verification states (e.g. REJECTED). | ACTIVE non-admin only; allow-listed fields; verification mapped to VERIFIED/UNVERIFIED. | S |
| D13 | H | Web | Top-level `app/page.tsx` has no root layout (the root layout is `[locale]/layout.tsx`): Next fails on `/`. | Removed; redirect `/ -> /en` in `next.config.ts`. | U (Next not runnable) |
| D14 | H | Business rule | Either party could review a COMPLETED booking and the status then became REVIEWED, so a host could review first and lock the traveler out; check-then-create was also racy. | Only the traveler of the booking may review (matches spec: hosts "receive ratings"); conditional status change + create in one transaction; P2002 -> 409. | S |
| D15 | H | Admin | No audit trail for privileged actions; last-admin check was racy; missing host/report returned 500. | `AuditLog` model; every admin mutation in a serializable transaction with an audit row; 404s; deactivation revokes refresh tokens; `GET /admin/audit-logs`. | S |
| D16 | H | Abuse | No rate limiting or brute-force protection. | In-memory limiter + global guard: global and per-route per-IP limits, per-account login throttle. Limits and caveats documented. | R (limiter) / S (guard) |
| D17 | H | Availability | Unbounded list queries (destinations, experiences, trips, bookings, reports) and arrays/strings without limits. | `take/skip` (<=100), caps on lists, bounded DTO fields. | S |
| D18 | M | Profiles | Completion was computed from the request body only, so a partial update replaced a good score with a wrong one; DTO classes (target ES2022, `useDefineForClassFields`) also carry `undefined` keys that would overwrite stored values in a naive merge. | Compute from the merged persisted record; `definedOnly()`. | R (completion.spec reproduces 13% vs 50%) |
| D19 | M | Validation | Profile/experience/trip DTOs: arrays of anything, unbounded strings/numbers, destination/trip ids not UUID-checked (invalid ids reach Prisma as 500), `active` not boolean. | `IsString({each})`, sizes, ranges, `IsUUID`, `IsBoolean`, https-only photo URLs; `ParseUUIDPipe` on params and the `destinationId` query. | S |
| D20 | M | Auth | Duplicate simultaneous registrations hit the unique index and returned 500. | P2002 -> 409. | S |
| D21 | M | Auth | Unknown accounts skipped hashing (timing user-enumeration). | Dummy scrypt verification. | S |
| D22 | M | Auth | Refresh rotation was not atomic; an expired token revoked all sessions. | Transaction with conditional consume + successor; expired token only rejected; logout is public (refresh token is the credential). | S |
| D23 | M | Config | `PrismaService` used `process.env.NODE_ENV` while `ConfigService` defaults to development: with NODE_ENV unset the app connected and crashed without a database. | Uses `ConfigService`. | S |
| D24 | M | Config | `ACCESS_TOKEN_TTL` regex accepted `ms`/`y` (jose rejects them at first login) and any size. | Pure `config-rules.ts`: s/m/h/d, 1 min - 24 h. | R |
| D25 | M | Errors | Unexpected exceptions returned 500 but were never logged. | Logged server-side; Prisma errors log only class name and code (messages can embed password hashes). | S |
| D26 | M | Hardening | No security headers, `x-powered-by` on, no shutdown hooks, no proxy-trust setting. | Minimal headers middleware, `enableShutdownHooks`, `TRUST_PROXY`. | S |
| D27 | M | Matching | Suspended hosts were matched; comparison was case-sensitive; duplicates double counted; ties unordered. | Pure `scoreHost` (NaN-safe, 0-100, explained components), ACTIVE hosts only, deterministic tie-break. | R |
| D28 | M | Authorization | 403 vs 404 on trips/bookings/reviews let callers probe which ids exist. | 404 for non-owners/non-participants. | S |
| D29 | M | Notifications | Nothing ever created notifications; marking another user's id succeeded silently. | Notifications on booking, review, message events (best effort, bilingual); 404 when not owned. | S |
| D30 | M | Bookings | One traveler could hold many open bookings for the same experience; bookable experiences of suspended hosts. | Duplicate check; host ACTIVE required; listing filters. | S |
| D31 | M | Messaging | Self-message returned 403, blank-after-trim body accepted, no throttle. | 400 / 400 / 30 per minute. | S |
| D32 | M | Seed | Seed could create a known admin account in production. | Refuses `NODE_ENV=production`. | S |
| D33 | M | Web | Parallel 401s each sent the same rotating refresh token (replay detection would revoke the session); no logout UI; unhandled promise rejections (assistant), swallowed errors (notifications), missing unauthorized states, double submits, English-only labels in the Arabic UI, itinerary day fixed to 1, country badge ignoring locale. | Single in-flight refresh, logout link, error/loading/anon states, busy guards, localized labels, day input. | S (`lib/api.ts` strict-typechecks: R) |
| D34 | M | Schema | No indexes for `Experience.hostProfileId` and `Booking(experienceId,status)` (capacity query). | Added both. | S |
| D35 | L | Tooling | `scripts/static-audit.mjs` heuristics were vacuous (e.g. substring `me` always matched), so earlier "audit PASS" claims were not meaningful; "parser audit" claims were not reproducible from the repository. | Script rewritten with specific checks (18); verified to fail on the baseline (11 checks) and pass now. | R |
| D36 | L | Docs | Docs claimed behaviors that did not exist (notifications, public profile whitelist, logout auth). | Rewritten to match code. | S |

### Second-audit result
Re-ran after all fixes: syntax parse of all 95 TS/TSX files (no syntax errors; the only diagnostics are type errors that exist solely because packages are missing), strict `tsc` on every dependency-free module, the 41 runtime tests, the static-audit script, greps for `any`, `as any`, `as never`, `Object.assign`, `req.body`, `...dto`, `user: true`, `console.*`, unguarded `update/delete`, invisible Unicode and curly quotes (none found in code). Remaining `any` usages are in `web/admin`, `web/destination`, `web/trips` (`catch (e: any)`): listed as debt. Every remaining `update/delete where {id}` was reviewed and is preceded by an ownership/existence check in the same flow.

## 13. Dependency status — BLOCKED — PACKAGE INSTALLATION / REGISTRY UNAVAILABLE
No `npm install`, `npm audit` or `npm outdated`; no lockfile exists and none was invented.

## 14. TypeScript status
PASS (executed): `tsc --strict` on `config-rules, rate-limiter, password, booking-rules, score, completion, load-env` (against an on-disk `@types/node`) and on `web/lib/api.ts`. PASS: syntax-only parse of all 95 TS/TSX files. BLOCKED: full typecheck of Nest/Next files (82 missing-module errors and errors derived from them).

## 15. Prisma status
BLOCKED: `prisma generate/validate/migrate`; no migration directory exists. Schema reviewed manually (all named relations pair up). STATIC risk to confirm with `prisma validate`: `Booking.hostId` is the foreign key of two relations (`host` -> User, `hostProfile` -> HostProfile.userId). Changes: 2 indexes, `AuditLog` model.

## 16-18. Tests, build, E2E
- PASS (executed, custom runner `scripts/mini-jest.mjs`, NOT Jest; negative control confirmed it exits 1 on failures): **41 tests, 0 failed** — config rules (7), rate limiter (6), password hashing (5), booking state machine (9), matching score (8), profile completion (6).
- PASS (executed): `npm run audit:static` 18/18 (11 of them fail on the baseline).
- BLOCKED: Jest, `nest build`, `next build`, DB integration, HTTP and E2E (auth, traveler, host, booking, unauthorized-access flows). **NOT TESTED:** all controller/guard/service wiring, serializable-transaction behavior, rate-limit guard behavior, browser rendering and RTL layout.
- STATIC VERIFIED only: every Nest service/controller/DTO/module, Prisma queries, all React pages.

## 19-20. Remaining blockers and technical debt
1. Registry/Postgres unavailable (all runtime verification above).
2. `jose` v6 is believed to be ESM-only; the API compiles to CommonJS. UNVERIFIED: works only on Node >= 22.12 (declared) or after pinning jose v5.
3. ts-jest 29 with Jest 30 compatibility UNVERIFIED.
4. Bookings have no date or party size, so capacity is a global count of open bookings; EXPIRED and DISPUTED are unreachable (no job/workflow); no host or review UI; no way for a traveler to become a host except an admin role change (no host-application flow).
5. Localization uses inline strings (no dictionaries); validation messages from the API are English.
6. Tokens in `localStorage`; no email/phone verification or password reset; no web security headers; no messaging conversations/blocking/read state; limiter is per process; `any` in three web files; photo URLs are arbitrary https links; no E2E suite; no cursor pagination.
7. Clean-up of a stale doc claim: earlier "PASS" lines in the previous state file that came from the old heuristic script are historical, not evidence.

## 21. Final audit status
PARTIAL / BLOCKED BY ENVIRONMENT. 36 defects found and repaired in source (1 critical, 16 high, 17 medium, 2 low); 0 known defects left unrepaired except the debt above. Repairs are verified at the level stated in the Evidence column only.

## 22. Exact next action
On a networked machine: `npm install` (creates the real lockfile) -> `npm run db:generate` -> `npx prisma validate` -> `npx prisma migrate dev --name init` -> `npm run typecheck` -> `npm test` -> `npm run build`; fix whatever surfaces (watch: Prisma types in the new services, `Booking.hostId` double relation, jose/CommonJS, DTO decorator helpers, Next root-layout redirect). Then run the HTTP/E2E flows from the audit prompt (register, login, me, refresh, logout, profile, booking lifecycle, and the unauthorized-access attempts) and finally `npm audit`.

---
# APPENDIX — previous audit report (pre-existing, kept for history; its PASS claims were not re-verified)

# SMART TRAVEL — DEEP CODE AUDIT REPORT

Date: 2026-10-06
Scope: entire local project archive after second audit/fix pass.

## Audit depth

The audit covered:
- every TypeScript/TSX source file;
- JSON configuration files;
- Prisma schema and relations;
- NestJS modules/controllers/services/DTOs;
- authentication and token lifecycle;
- authorization and object ownership;
- booking state transitions;
- profile privacy;
- mass-assignment surfaces;
- database relationship integrity;
- seed idempotency;
- frontend/API contract surfaces;
- static security patterns;
- syntax/parser validity;
- project feature coverage against the agreed Smart Travel architecture.

## Quantitative results

- Files in audited project: 89
- TypeScript/TSX files: 81
- TypeScript parser errors: 0
- JSON files checked: 6
- JSON parse errors: 0
- Hardcoded-secret patterns: 0
- Destructive command references in source: 0
- Partial DTO references: 0
- Duplicate Prisma providers outside CommonModule: 0
- Required API-domain checks: PASS

## Defects found and fixed

### Critical / high-impact
1. **Health authorization defect** — `/api/v1/health` was behind the default-deny auth guard. Fixed with `@Public()`.
2. **Prisma client duplication** — feature modules independently provided `PrismaService`. Fixed with a global `CommonModule`.
3. **Missing Prisma message recipient relation** — fixed with `User.receivedMessages` and `Message.recipient`.
4. **Invalid Prisma query shape** — profile `me` mixed `include` and `select`. Fixed.
5. **Booking authorization flaw** — actor was not tied to valid state transitions. Fixed with separate host/traveler transition maps.
6. **Booking ownership flaw** — arbitrary trip IDs could be attached to bookings. Fixed with traveler ownership verification.
7. **DTO mass-assignment risk** — update endpoints accepted runtime `Partial<DTO>` objects. Replaced with explicit validated DTOs.
8. **Admin password-hash exposure** — mutation responses could return full User objects. Fixed with safe selects.
9. **Seed secret in source** — removed hardcoded password; seed requires environment secret.
10. **Itinerary referential-integrity gap** — added Experience relation.
11. **Report referential-integrity gap** — added optional reported-user relation.

### Medium / reliability
12. Refresh-token rotation now atomically consumes the old token before issuing its replacement.
13. Inactive users are blocked from refresh and their outstanding refresh tokens are revoked.
14. Booking capacity is checked before new active bookings are created.
15. UUID path parameters now reject malformed IDs early.
16. Seed experience creation is idempotent.
17. Browser API client automatically performs one refresh/retry cycle after an expired access token.
18. Public profile output now explicitly whitelists public information.
19. Trip and itinerary operations enforce ownership.
20. Admin protection prevents removing/deactivating the last active administrator.

## Remaining limitations

These are not hidden failures; they are explicitly unverified or intentionally deferred:

- Runtime dependency installation is unavailable in this environment.
- Prisma migration has not been generated by Prisma CLI.
- PostgreSQL integration has not executed.
- Jest has not executed.
- HTTP E2E and Playwright have not executed.
- Rate limiting/brute-force protection is still required before public exposure.
- Email/phone verification and password recovery are not implemented.
- Secure headers/CSP require final production review.
- External AI provider is optional; current provider is deterministic fallback.
- Some advanced admin/host/review UI surfaces remain to be expanded.

## Final audit verdict

**STATIC CODE AUDIT: PASS**

**RUNTIME BUILD/TEST: BLOCKED BY ENVIRONMENT**

The project is materially safer and more internally consistent after this audit, but it must not be called production-ready until dependencies, Prisma, PostgreSQL, Jest, HTTP integration and E2E tests execute successfully.
