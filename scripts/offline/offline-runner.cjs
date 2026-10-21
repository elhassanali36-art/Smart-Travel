// Dependency-free stand-in for Jest, used ONLY when packages cannot be installed. It is NOT Jest.
// It runs the same *.spec.ts files with ts-node (transpile only) and offline stubs for @nestjs/common,
// @prisma/client and jose (see ./stubs). Real Jest + real packages remain the release gate.
const path = require('node:path');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');

const stubs = path.join(__dirname, 'stubs', 'packages');
process.env.NODE_PATH = [stubs, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
require('node:module').Module._initPaths();
const globalRoot = execSync('npm root -g').toString().trim();
require(require.resolve('ts-node', { paths: [globalRoot] })).register({
  transpileOnly: true, skipProject: true,
  compilerOptions: { module: 'node16', moduleResolution: 'node16', target: 'ES2022', experimentalDecorators: true, emitDecoratorMetadata: false, esModuleInterop: true, strict: false },
});

const suites = [];
let cur = { name: '', tests: [] };
globalThis.describe = (name, fn) => { const prev = cur; cur = { name: prev.name ? `${prev.name} > ${name}` : name, tests: [] }; suites.push(cur); fn(); cur = prev; };
globalThis.it = globalThis.test = (name, fn) => cur.tests.push({ name, fn });
const fmt = (v) => { try { return JSON.stringify(v) ?? String(v); } catch { return String(v); } };
const subset = (a, e) => a !== null && typeof a === 'object' && Object.entries(e).every(([k, v]) => (v !== null && typeof v === 'object' ? subset(a[k], v) : Object.is(a[k], v)));
const msgOk = (err, arg) => arg === undefined || (arg instanceof RegExp ? arg.test(err?.message ?? '') : typeof arg === 'function' ? err instanceof arg : (err?.message ?? '').includes(arg));
function m(get, neg, mode) {
  const chk = (cond, msg) => { if (neg ? cond : !cond) throw new assert.AssertionError({ message: (neg ? 'NOT: ' : '') + msg }); };
  const run = async (fn) => { const v = get(); if (mode === 'resolves') return fn(await v); if (mode === 'rejects') { let e, t = false; try { await v; } catch (x) { t = true; e = x; } if (!t) throw new assert.AssertionError({ message: 'expected rejection' }); return fn(e); } return fn(v); };
  const w = (fn) => (mode ? run(fn) : fn(get()));
  return {
    toBe: (e) => w((a) => chk(Object.is(a, e), `${fmt(a)} toBe ${fmt(e)}`)),
    toEqual: (e) => w((a) => { let ok = true; try { assert.deepStrictEqual(a, e); } catch { ok = false; } chk(ok, `${fmt(a)} toEqual ${fmt(e)}`); }),
    toBeUndefined: () => w((a) => chk(a === undefined, `${fmt(a)} undefined`)), toBeDefined: () => w((a) => chk(a !== undefined, 'defined')),
    toBeNull: () => w((a) => chk(a === null, `${fmt(a)} null`)), toBeTruthy: () => w((a) => chk(!!a, `${fmt(a)} truthy`)),
    toContain: (e) => w((a) => chk(typeof a === 'string' ? a.includes(e) : Array.isArray(a) && a.includes(e), `${fmt(a)} contain ${fmt(e)}`)),
    toHaveLength: (n) => w((a) => chk(a?.length === n, `length ${a?.length} vs ${n}`)), toBeGreaterThan: (n) => w((a) => chk(a > n, `${a} > ${n}`)),
    toMatchObject: (o) => w((a) => chk(subset(a, o), `${fmt(a)} matchObject ${fmt(o)}`)),
    toThrow: (arg) => { if (mode === 'rejects') return run((e) => chk(msgOk(e, arg), `rejection ${fmt(e?.message)} vs ${arg}`)); let t = false, e; try { get()(); } catch (x) { t = true; e = x; } return chk(t && msgOk(e, arg), 'toThrow'); },
  };
}
globalThis.expect = (a) => ({ ...m(() => a, false, null), not: m(() => a, true, null), resolves: m(() => a, false, 'resolves'), rejects: m(() => a, false, 'rejects') });

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: offline-runner.cjs <spec files>'); process.exit(2); }
for (const f of files) require(path.resolve(f));
(async () => {
  let pass = 0, fail = 0;
  for (const s of suites) for (const t of s.tests) {
    try { await t.fn(); pass++; console.log(`ok - ${s.name} > ${t.name}`); } catch (e) { fail++; console.log(`not ok - ${s.name} > ${t.name}\n    ${String(e.message).split('\n')[0]}`); }
  }
  console.log(`\n${pass} passed, ${fail} failed (offline runner with stubs, not Jest)`);
  process.exit(fail ? 1 : 0);
})();
