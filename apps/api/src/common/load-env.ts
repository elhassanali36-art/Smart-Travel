import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The API does not use dotenv: load the first .env found (apps/api, then the repo root) with the
// built-in Node loader. Variables already present in the environment always win.
export function loadEnvFiles(): void {
  for (const file of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}

loadEnvFiles();
