import { defineConfig } from '@playwright/test';

// Needs: PostgreSQL + migrated/seeded DB, the API on :4000, and the web app (started here unless E2E_NO_SERVER is set).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000' },
  webServer: process.env.E2E_NO_SERVER ? undefined : { command: 'npm run dev', url: 'http://localhost:3000/en', reuseExistingServer: true, timeout: 120_000 },
});
