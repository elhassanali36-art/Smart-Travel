// Loads every non-test API source file with ts-node (transpile only) and the offline stubs, so import
// errors, undefined references at class-definition time (decorators) and syntax mistakes surface.
// It does NOT prove Nest dependency injection (that needs the real packages: see app.module.spec.ts).
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
process.env.NODE_PATH = path.join(__dirname, 'stubs', 'packages');
require('node:module').Module._initPaths();
require(require.resolve('ts-node', { paths: [execSync('npm root -g').toString().trim()] })).register({
  transpileOnly: true, skipProject: true,
  compilerOptions: { module: 'node16', moduleResolution: 'node16', target: 'ES2022', experimentalDecorators: true, esModuleInterop: true },
});
const root = path.resolve(process.argv[2]);
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.ts') && !f.endsWith('.spec.ts') && !f.endsWith('/main.ts') && !f.includes('/testing/')) files.push(f); } })(root);
let failed = 0;
for (const f of files) { try { require(f); } catch (e) { failed++; console.log(`FAIL ${path.relative(root, f)}: ${String(e.message).split('\n')[0]}`); } }
console.log(`${files.length - failed}/${files.length} modules loaded`);
process.exit(failed ? 1 : 0);
