# SMART TRAVEL — MASTER BUILD SPEC

Greenfield, production-oriented bilingual intelligent travel platform.

## Locked architecture
Next.js + React + TypeScript web; NestJS + TypeScript API; PostgreSQL + Prisma; REST API; Arabic RTL and English LTR.

## Roles
TRAVELER, LOCAL_HOST, ADMIN.

## Required product domains
Authentication/authorization, traveler/host profiles, destinations/discovery, local experiences, explainable 0–100 matching, server-side AI provider abstraction, trip planner, messaging, notifications, booking workflow, reviews, safety/reporting, admin control center, analytics and monetization-ready architecture.

## Engineering rules
Inspect before modifying. Never reset/rebuild/delete working phases. Implement → Verify → Fix → Re-verify → Checkpoint → Continue. Never fabricate PASS. Runtime blockers are BLOCKED; source inspection is STATIC VERIFIED. No fake buttons, fake API responses or hardcoded production secrets. Database changes must be migration-safe and non-destructive.

## Booking state machine
REQUESTED → ACCEPTED → CONFIRMED → COMPLETED → REVIEWED; alternatives REJECTED, CANCELLED, EXPIRED, DISPUTED.

## Security
Passwords use strong server-side hashing. Access tokens are short-lived. Refresh tokens are opaque, hashed at rest and rotated. Roles are server-side. AI output is untrusted. Private data is not public profile data. Production exposure requires rate limiting, secure headers, verification/recovery flows, dependency audit, real database tests and E2E verification.
