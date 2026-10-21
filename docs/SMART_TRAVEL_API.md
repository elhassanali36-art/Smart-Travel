# Smart Travel API

Base path `/api/v1`. Every route needs `Authorization: Bearer <accessToken>` unless marked **public** (default-deny global guard). Errors: `{ statusCode, error: <payload> }`. Status codes: invalid body/params 400 (unknown properties and malformed UUIDs included), 401 unauthenticated, 403 forbidden, 404 missing (also used for resources of other users), 409 conflict/duplicate/concurrent change, 429 rate limited (with `Retry-After`), 500 unexpected (generic body, details only in server logs). Known Prisma client errors (P2002, P2025, P2003, P2023, P2034) are mapped to 409/404/409/400/409.

## Authentication transport
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` return `{ accessToken, expiresIn }`. The **refresh token is never in a response body**: it is set as the `st_refresh` cookie (`HttpOnly`, `Secure` outside development, `SameSite=Lax` by default via `COOKIE_SAMESITE`, `Path=/api/v1/auth`).
- `refresh` and `logout` are cookie-authenticated, so they also require an `Origin` header equal to `WEB_ORIGIN` (403 otherwise). Non-browser clients must send that header and keep the cookie.
- CORS: exact `WEB_ORIGIN`, credentials allowed. The web client keeps the access token in memory only.

## Public routes
- `GET /health`
- `POST /auth/register` `{name, email?, phone?, password}` (blank strings are absent; email or phone required; password 8-128 chars) - always a TRAVELER
- `POST /auth/login` `{email|phone, password}` - same 401 for unknown account and wrong password; 403 for an inactive account only after a correct password; 429 after 10 failed attempts per account / 15 min
- `POST /auth/refresh` (cookie), `POST /auth/logout` (cookie) - rotation with replay detection (a replayed token revokes all sessions of the user)
- `GET /destinations?q&take&skip` (take <= 100), `GET /destinations/:id` (hosts exposed as `{id, city, country, verification, user:{id,name}}`)
- `GET /experiences?destinationId&category&take&skip` (active experiences of ACTIVE hosts)

## Authenticated routes
- `GET /auth/me`, `GET /auth/admin-check` (ADMIN)
- Profiles: `GET /profiles/me`, `PUT /profiles/me/traveler`, `PUT /profiles/me/host` (LOCAL_HOST/ADMIN), `GET /profiles/:id` (ACTIVE non-admin users, allow-listed fields, verification shown only as VERIFIED/UNVERIFIED)
- Matching: `GET /matching/hosts`; AI: `POST /ai/recommend` (advisory text only)
- Experiences: `GET /experiences/mine` (LOCAL_HOST/ADMIN, includes inactive), `POST /experiences`, `PUT /experiences/:id` (owner only; `active:false` deactivates)
- Trips: `GET|POST /trips`, `PUT /trips/:id`, `POST /trips/:id/itinerary`, `PUT|DELETE /trips/:id/itinerary/:itemId` (owner only, others get 404)
- Reviews: `POST /reviews/:bookingId` (the traveler of a COMPLETED booking only), `GET /reviews/user/:userId`
- Messages: `GET /messages` (newest 200, oldest first), `POST /messages` (30/min); Notifications: `GET /notifications`, `POST /notifications/:id/read` (404 if not yours); Reports: `POST /reports` (10/min)

## Bookings
`POST /bookings` (TRAVELER) `{experienceId, startsAt (ISO), guests (1-100), tripId?, note?}`. `startsAt` must be 1 hour to 365 days ahead; the server computes `endsAt = startsAt + durationMinutes`. `capacity` is the maximum number of guests per session: the sum of `guests` of open bookings (REQUESTED/ACCEPTED/CONFIRMED) overlapping `[startsAt, endsAt)` plus the new party must not exceed it (back-to-back sessions do not overlap). The check and insert run in one serializable transaction (retried on conflict). A traveler cannot hold two overlapping open bookings for the same experience. Response deadline `expiresAt = min(now + 48 h, startsAt)`.

- `GET /bookings` - traveler: own (with trip); host: own as host (never the trip); admin: all
- `POST /bookings/:id/status/:status` with `status` in ACCEPTED, REJECTED, CONFIRMED, CANCELLED, COMPLETED
- `POST /bookings/:id/dispute` `{reason (10-2000 chars)}` - participants; reason, time and author are persisted
- ADMIN: `GET /bookings/disputes`, `POST /bookings/:id/resolve` `{outcome: COMPLETED|CANCELLED, note}` (audited), `POST /bookings/expire-overdue` (audited)

| From | To | Who | Condition |
|---|---|---|---|
| REQUESTED | ACCEPTED / REJECTED | host | not overdue; accept only before the start |
| REQUESTED | CANCELLED | traveler | before the start |
| ACCEPTED | CONFIRMED | traveler | not overdue, before the start |
| ACCEPTED, CONFIRMED | CANCELLED | traveler or host | before the start |
| CONFIRMED | COMPLETED | host or traveler | after `endsAt` |
| CONFIRMED | DISPUTED | host or traveler | after `startsAt` |
| COMPLETED | DISPUTED | host or traveler | within 14 days after `endsAt` |
| REQUESTED, ACCEPTED | EXPIRED | system | `expiresAt` passed (lazy, see below) |
| COMPLETED | REVIEWED | system, via the review endpoint | traveler of the booking |
| DISPUTED | COMPLETED / CANCELLED | administrator | resolution note, audited |

Everything else is rejected (400), including any change out of REJECTED, CANCELLED, EXPIRED and REVIEWED. Participants are the only users who can act; others get 404, administrators 403 on the user workflow. Updates are conditional on the status that was validated (409 if it changed meanwhile).

**Expiry is lazy, not scheduled.** Overdue REQUESTED/ACCEPTED bookings are marked EXPIRED when bookings are listed, created or acted on, and by `POST /bookings/expire-overdue`. **There is no background scheduler**; run that endpoint from a cron job if you need timely expiry. Notifications are created (best effort) for booking, review and message events.

## Admin (ADMIN only)
`GET /admin/overview|users|reports|audit-logs`, `PATCH /admin/users/:id/status`, `PATCH /admin/users/:id/role`, `PATCH /admin/hosts/:id/verification`, `PATCH /admin/reports/:id`, `GET /analytics/summary`. Mutations run in serializable transactions with an `AuditLog` row; deactivating a user revokes their refresh tokens; the last active administrator cannot be demoted or deactivated.

## Rate limits (per IP, in memory, per process)
Global 300/min; register 10/min, login 10/min (+10 failures per account per 15 min), refresh 30/min, logout 30/min, messages 30/min, reports 10/min, AI 20/min. Behind a reverse proxy set `TRUST_PROXY` (hops), otherwise every client shares the proxy IP.
