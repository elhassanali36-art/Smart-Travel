// Verifies en/ar dictionaries: identical keys, matching {placeholders}, no empty values.
import { en } from '../locales/en.ts';
import { ar } from '../locales/ar.ts';

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const a = Object.fromEntries(flat(en));
const b = Object.fromEntries(flat(ar));
const problems = [];
for (const k of Object.keys(a)) if (!(k in b)) problems.push(`missing in ar: ${k}`);
for (const k of Object.keys(b)) if (!(k in a)) problems.push(`missing in en: ${k}`);
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const k of Object.keys(a)) if (k in b) {
  if (vars(a[k]) !== vars(b[k])) problems.push(`placeholder mismatch: ${k}`);
  if (!String(a[k]).trim() || !String(b[k]).trim()) problems.push(`empty value: ${k}`);
}
console.log(JSON.stringify({ keys: Object.keys(a).length, problems }, null, 1));
process.exit(problems.length ? 1 : 0);
