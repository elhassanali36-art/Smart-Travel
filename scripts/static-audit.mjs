// Heuristic repository checks (regex based, NOT a parser and NOT a substitute for tests).
// Run: npm run audit:static
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'dist'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    e.isDirectory() ? walk(full) : files.push(full);
  }
})(root);

const rel = (f) => path.relative(root, f);
// A missing file reads as empty text so a check fails instead of crashing the whole audit.
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
// Production sources only: specs, the in-memory test double and the translation dictionaries are excluded.
const src = files.filter((f) => /\.(ts|tsx)$/.test(f) && !/\.spec\.ts$/.test(f) && !/\/testing\//.test(f) && !/\/locales\//.test(f));
const api = src.filter((f) => rel(f).startsWith('apps/api'));
const has = (re, f) => re.test(read(path.join(root, f)));
const anyApi = (re) => api.filter((f) => re.test(read(f))).map(rel);

const controllers = api.filter((f) => f.endsWith('.controller.ts'));
const routes = controllers.flatMap((f) => [...read(f).matchAll(/@Controller\('([^']*)'\)/g)].map((m) => m[1]));
const requiredRoutes = ['auth', 'profiles', 'destinations', 'experiences', 'matching', 'trips', 'bookings', 'reviews', 'messages', 'notifications', 'reports', 'admin', 'analytics', 'ai', 'health'];

const checks = {
  allRequiredControllersPresent: requiredRoutes.every((r) => routes.includes(r)),
  healthPublic: has(/@Public\(\)[\s\S]*@Get\(\)/, 'apps/api/src/common/health.controller.ts'),
  noFullUserIncludesInApi: anyApi(/\buser:\s*true\b/).length === 0,
  noRequestBodyOrObjectAssign: anyApi(/req\.body|request\.body|Object\.assign|\.\.\.dto\b/).length === 0,
  noPartialDtos: anyApi(/Partial<\w+Dto>/).length === 0,
  noHardcodedSecrets: src.filter((f) => /(JWT_SECRET\s*[:=]\s*['"][^'"]+['"]|password\s*[:=]\s*['"][^'"]{4,}['"])/i.test(read(f))).length === 0,
  noDestructiveCommands: files.filter((f) => !f.endsWith('static-audit.mjs') && /prisma migrate reset|DROP DATABASE|TRUNCATE TABLE/i.test(read(f))).length === 0,
  prismaOwnedOnlyByCommonModule: anyApi(/providers:\s*\[[^\]]*PrismaService/).filter((f) => !f.endsWith('common.module.ts')).length === 0,
  rateLimitGuardRegistered: has(/APP_GUARD[\s\S]*RateLimitGuard/, 'apps/api/src/common/common.module.ts'),
  authGuardRegistered: has(/APP_GUARD[\s\S]*AuthGuard/, 'apps/api/src/auth/auth.module.ts'),
  requestUserHasNoPasswordHash: has(/select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*role:\s*true,\s*status:\s*true\s*\}/, 'apps/api/src/auth/auth.service.ts'),
  bookingTransitionIsConditional: has(/updateMany\(\{\s*where:\s*\{\s*id,\s*status:\s*b\.status/, 'apps/api/src/bookings/bookings.service.ts'),
  bookingCreateIsSerializable: has(/runSerializable/, 'apps/api/src/bookings/bookings.service.ts'),
  refreshRotationIsTransactional: has(/\$transaction[\s\S]*revokedAt:\s*null/, 'apps/api/src/auth/auth.service.ts'),
  adminMutationsAreAudited: (read(path.join(root, 'apps/api/src/admin/admin.controller.ts')).match(/auditLog\.create/g) ?? []).length >= 4,
  auditLogModelExists: has(/model AuditLog/, 'prisma/schema.prisma'),
  seedRefusesProduction: has(/NODE_ENV === 'production'/, 'prisma/seed.ts'),
  refreshTokenNeverInResponseBody: !/return\s*\{[^}]*refreshToken\s*:/.test(read(path.join(root, 'apps/api/src/auth/auth.controller.ts'))),
  refreshCookieIsHttpOnly: has(/httpOnly:\s*true/, 'apps/api/src/common/cookies.ts'),
  webNeverStoresTokens: src.filter((f) => /localStorage\.\w+Item\(\s*['"](accessToken|refreshToken)/.test(read(f)) || /sessionStorage/.test(read(f))).length === 0,
  bookingHasScheduleAndGuests: has(/model Booking[\s\S]*startsAt DateTime[\s\S]*endsAt DateTime[\s\S]*guests Int/, 'prisma/schema.prisma'),
  noDoubleHostRelation: !has(/hostProfileBookings/, 'prisma/schema.prisma'),
  joseIsCommonJsCompatible: /"jose":\s*"\^5\./.test(read(path.join(root, 'apps/api/package.json'))) && /"module":\s*"commonjs"/.test(read(path.join(root, 'apps/api/tsconfig.json'))),
  jestVersionsCoherent: ['"jest": "^29', '"ts-jest": "^29', '"@types/jest": "^29'].every((x) => read(path.join(root, 'apps/api/package.json')).includes(x)),
  nestCliDeclared: read(path.join(root, 'apps/api/package.json')).includes('"@nestjs/cli"'),
  playwrightDeclared: read(path.join(root, 'apps/web/package.json')).includes('"@playwright/test"'),
  dictionariesExist: fs.existsSync(path.join(root, 'apps/web/locales/en.ts')) && fs.existsSync(path.join(root, 'apps/web/locales/ar.ts')),
  noTopLevelWebPage: !fs.existsSync(path.join(root, 'apps/web/app/page.tsx')),
};

const result = { files: files.length, sourceFiles: src.length, controllers: routes.sort(), checks };
console.log(JSON.stringify(result, null, 2));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
