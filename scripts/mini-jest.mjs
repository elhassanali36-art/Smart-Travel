// Dependency-free stand-in runner for FRAMEWORK-FREE specs only (no Nest/class-validator imports).
// It is NOT Jest. Real Jest remains the project's test runner; this exists so pure logic can be
// executed while the npm registry is unreachable. Usage:
//   node --experimental-strip-types --no-warnings scripts/mini-jest.mjs <spec files...>
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

register(
  'data:text/javascript,' +
    encodeURIComponent(`export async function resolve(s, c, next) {
      try { return await next(s, c); }
      catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND' && (s.startsWith('.') || s.startsWith('/'))) return next(s + '.ts', c); throw e; }
    }`),
  import.meta.url,
);

const suites = [];
let current = { name: '', tests: [], beforeAll: [], afterAll: [] };
globalThis.describe = (name, fn) => {
  const prev = current;
  current = { name: prev.name ? `${prev.name} > ${name}` : name, tests: [], beforeAll: [], afterAll: [] };
  suites.push(current);
  fn();
  current = prev;
};
globalThis.describe.skip = () => {};
globalThis.it = (name, fn) => current.tests.push({ name, fn });
globalThis.test = globalThis.it;
globalThis.beforeAll = (fn) => current.beforeAll.push(fn);
globalThis.afterAll = (fn) => current.afterAll.push(fn);

const fmt = (v) => { try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v); } catch { return String(v); } };
const subset = (actual, expected) =>
  actual !== null && typeof actual === 'object' &&
  Object.entries(expected).every(([k, v]) =>
    v !== null && typeof v === 'object' ? subset(actual[k], v) : Object.is(actual[k], v));
const matchMsg = (err, arg) => (arg === undefined ? true : arg instanceof RegExp ? arg.test(err?.message ?? '') : (err?.message ?? '').includes(arg));

function matchers(getValue, neg, mode) {
  const pass = (cond, msg) => { if (neg ? cond : !cond) throw new assert.AssertionError({ message: (neg ? 'NOT: ' : '') + msg }); };
  const run = async (fn) => {
    const v = getValue();
    if (mode === 'resolves') return fn(await v);
    if (mode === 'rejects') { let err, threw = false; try { await v; } catch (e) { threw = true; err = e; } if (!threw) throw new assert.AssertionError({ message: 'expected promise to reject' }); return fn(err); }
    return fn(v);
  };
  const wrap = (fn) => (mode ? run(fn) : fn(getValue()));
  return {
    toBe: (e) => wrap((a) => pass(Object.is(a, e), `expected ${fmt(a)} toBe ${fmt(e)}`)),
    toEqual: (e) => wrap((a) => { let ok = true; try { assert.deepStrictEqual(a, e); } catch { ok = false; } pass(ok, `expected ${fmt(a)} toEqual ${fmt(e)}`); }),
    toBeUndefined: () => wrap((a) => pass(a === undefined, `expected ${fmt(a)} undefined`)),
    toBeDefined: () => wrap((a) => pass(a !== undefined, 'expected defined')),
    toBeNull: () => wrap((a) => pass(a === null, `expected ${fmt(a)} null`)),
    toBeTruthy: () => wrap((a) => pass(!!a, `expected ${fmt(a)} truthy`)),
    toContain: (e) => wrap((a) => pass(typeof a === 'string' ? a.includes(e) : Array.isArray(a) && a.includes(e), `expected ${fmt(a)} toContain ${fmt(e)}`)),
    toMatch: (re) => wrap((a) => pass(re.test(a), `expected ${fmt(a)} toMatch ${re}`)),
    toHaveLength: (n) => wrap((a) => pass(a?.length === n, `expected length ${a?.length} toBe ${n}`)),
    toBeGreaterThan: (n) => wrap((a) => pass(a > n, `expected ${a} > ${n}`)),
    toMatchObject: (o) => wrap((a) => pass(subset(a, o), `expected ${fmt(a)} toMatchObject ${fmt(o)}`)),
    toThrow: (arg) => {
      if (mode === 'rejects') return run((err) => pass(matchMsg(err, arg), `rejection ${fmt(err?.message)} does not match ${arg}`));
      let threw = false, err; try { getValue()(); } catch (e) { threw = true; err = e; }
      return pass(threw && matchMsg(err, arg), threw ? `thrown ${fmt(err?.message)} vs ${arg}` : 'expected function to throw');
    },
  };
}
globalThis.expect = (actual) => ({
  ...matchers(() => actual, false, null),
  not: matchers(() => actual, true, null),
  resolves: matchers(() => actual, false, 'resolves'),
  rejects: matchers(() => actual, false, 'rejects'),
});

for (const f of process.argv.slice(2)) await import(pathToFileURL(resolve(f)).href);

let passed = 0, failed = 0;
for (const s of suites) {
  for (const fn of s.beforeAll) await fn();
  for (const t of s.tests) {
    try { await t.fn(); passed++; console.log(`ok - ${s.name} > ${t.name}`); }
    catch (e) { failed++; console.log(`not ok - ${s.name} > ${t.name}\n    ${String(e.message).split('\n')[0]}`); }
  }
  for (const fn of s.afterAll) await fn();
}
console.log(`\n${passed} passed, ${failed} failed (mini-jest, not Jest)`);
process.exit(failed ? 1 : 0);
