# Smart Travel Security

Evidence labels: **R** = executed here (offline runner/typecheck), **S** = static inspection only, **B** = blocked (needs installed packages, database or browser).

## Authentication and tokens
- Passwords: Node `crypto.scrypt`, 16-byte random salt, timing-safe comparison, 8-128 characters; unknown accounts still cost one scrypt verification (R: password.spec, auth.service.spec).
- Access token: HS256 via `jose` v5, issuer/audience checked, algorithm pinned, 1 min - 24 h lifetime (default 15 min). Role and status come from the database on every request; the request context never contains `passwordHash` (R). `jose` v5 is used because the API compiles to CommonJS and v6 is ESM-only; `jose.compat.spec.ts` must pass against the real package (B).
- Refresh token: opaque, only its SHA-256 is stored; rotation is a transaction with a conditional consume; replay revokes every session of the user; deactivated users cannot refresh (R with a fake database; real transaction behavior B).
- **Transport (changed):** the access token lives only in browser memory. The refresh token is an `HttpOnly` cookie scoped to `/api/v1/auth` (`Secure` outside development, `SameSite=Lax` by default). Page scripts cannot read it; a JWT is never written to localStorage/sessionStorage (S; checked by `audit:static` and the Playwright test). A non-secret "session hint" flag in localStorage only tells a reloaded page to attempt a silent refresh.
- **CSRF:** only `refresh` and `logout` use the cookie. They require `Origin` to equal `WEB_ORIGIN` (R: auth.controller.spec) in addition to `SameSite`. All other routes use the bearer header and are not CSRF-able. Use `COOKIE_SAMESITE=none` (HTTPS only) only if the web app lives on a different site than the API; Safari/ITP behavior then needs testing (B).
- Known limit: two tabs that refresh at the same instant can trigger replay detection and sign the user out.

## Authorization
Default-deny `AuthGuard` + `@Roles()`. Object-level checks: trips/itinerary (owner, 404 otherwise), experiences (owner), bookings (participants only), reviews (traveler of the booking), notifications (owner filter), profile writes (caller only), public profile/destination responses via allow-lists, hosts never receive a traveler's trip (R). Admin tooling is ADMIN-only with audited, serializable mutations and last-admin protection (admin metadata spec B; behavior of the fake-database flows R).

## Abuse protection
In-memory rate limiting (global, per route, per account for login). It is **process-local**: with several API instances each has its own counters, and a restart clears them. For a multi-instance deployment use a shared store (e.g. Redis) before exposing the API. An attacker can temporarily lock a victim's login by exhausting the per-account allowance (15 min).

## Headers and CORS
API responses carry `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive `Content-Security-Policy`, `Cache-Control: no-store`, and `Strict-Transport-Security` in non-development HTTPS deployments (production flag only); `x-powered-by` is disabled (R: header function; the middleware being applied at runtime is B). CORS allows only `WEB_ORIGIN` with credentials. The Next.js app sets **no** security headers yet (CSP/frame/referrer): add them before launch.

## Data protection
Explicit `select` allow-lists on public endpoints; Prisma error messages (which may embed query arguments) are never logged or returned; seed refuses production and requires `SEED_DEMO_PASSWORD`; no secret is committed (secret audit in the final report); `JWT_SECRET` placeholders/short values are rejected at startup.

## Open items (not production complete)
Email/phone verification and password reset; shared rate limiting; web security headers; media upload (photo URLs are user-supplied https links); dependency vulnerability scan (BLOCKED: registry 403); real integration/E2E security tests (B); no scheduler for booking expiry; no payments (none implemented); AI output is advisory text only and cannot change records.
