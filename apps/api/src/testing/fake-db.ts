import { randomUUID } from 'node:crypto';

// Small in-memory stand-in for the parts of PrismaService the services use. It is a TEST DOUBLE:
// it does not model SQL isolation, so concurrency is simulated through the `failNext*` switches.
type Row = Record<string, any>;

function matchValue(v: any, cond: any): boolean {
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
    if ('in' in cond && !cond.in.includes(v)) return false;
    if ('lt' in cond && !(v < cond.lt)) return false;
    if ('lte' in cond && !(v <= cond.lte)) return false;
    if ('gt' in cond && !(v > cond.gt)) return false;
    if ('gte' in cond && !(v >= cond.gte)) return false;
    return true;
  }
  if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
  return v === cond;
}
export function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (cond === undefined) return true;
    if (k === 'OR') return (cond as Row[]).some((w) => matches(row, w));
    if (k === 'AND') return (cond as Row[]).every((w) => matches(row, w));
    return matchValue(row[k], cond);
  });
}
const pick = (row: Row, select?: Row) => {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [k, v] of Object.entries(select)) if (v) out[k] = k in row ? row[k] : null;
  return out;
};

class Table {
  rows: Row[] = [];
  constructor(private readonly db: FakeDb, private readonly name: string) {}
  private find(where: Row) { return this.rows.find((r) => matches(r, where)) ?? null; }
  async findFirst(a: { where?: Row; select?: Row } = {}) { const r = this.find(a.where ?? {}); return r ? pick(r, a.select) : null; }
  async findUnique(a: { where: Row; select?: Row; include?: Row }) { const r = this.find(a.where); return r ? this.db.shape(this.name, r, a) : null; }
  async findUniqueOrThrow(a: { where: Row }) { const r = this.find(a.where); if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' }); return { ...r }; }
  async findMany(a: { where?: Row; take?: number; orderBy?: Row | Row[] } = {}) {
    this.db.calls.push({ table: this.name, op: 'findMany', args: a });
    let where = a.where ?? {};
    if (this.name === 'experience' && where.host?.userId) { // minimal relation filter: experience.host.userId
      const ids = this.db.hostProfile.rows.filter((h) => h.userId === where.host.userId).map((h) => h.id);
      const { host: _host, ...rest } = where; where = { ...rest, hostProfileId: { in: ids } };
    }
    const order = ([] as Row[]).concat(a.orderBy ?? []).flatMap((o) => Object.entries(o) as Array<[string, 'asc' | 'desc']>);
    const rows = this.rows.filter((r) => matches(r, where)).map((r, i) => ({ r, i }));
    rows.sort((x, y) => { for (const [k, dir] of order) { const av = x.r[k], bv = y.r[k]; if (av < bv) return dir === 'desc' ? 1 : -1; if (av > bv) return dir === 'desc' ? -1 : 1; } return x.i - y.i; });
    return rows.slice(0, a.take ?? 1000).map(({ r }) => ({ ...r }));
  }
  async count(a: { where?: Row } = {}) { return this.rows.filter((r) => matches(r, a.where ?? {})).length; }
  async aggregate(a: { where?: Row; _sum: Row }) { const rows = this.rows.filter((r) => matches(r, a.where ?? {})); const _sum: Row = {}; for (const k of Object.keys(a._sum)) _sum[k] = rows.length ? rows.reduce((n, r) => n + (r[k] ?? 0), 0) : null; return { _sum }; }
  async create(a: { data: Row; select?: Row }) {
    if (this.db.failNextCreate === this.name) { this.db.failNextCreate = null; throw Object.assign(new Error('unique'), { code: 'P2002' }); }
    const row: Row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...this.db.defaults(this.name), ...a.data };
    this.rows.push(row); return pick(row, a.select);
  }
  async update(a: { where: Row; data: Row }) { const r = this.find(a.where); if (!r) throw Object.assign(new Error('missing'), { code: 'P2025' }); Object.assign(r, a.data, { updatedAt: new Date() }); return { ...r }; }
  async updateMany(a: { where: Row; data: Row }) {
    if (this.db.failNextUpdateMany === this.name) { this.db.failNextUpdateMany = null; return { count: 0 }; }
    const hit = this.rows.filter((r) => matches(r, a.where)); hit.forEach((r) => Object.assign(r, a.data, { updatedAt: new Date() })); return { count: hit.length };
  }
  async delete(a: { where: Row }) { const i = this.rows.findIndex((r) => matches(r, a.where)); if (i < 0) throw Object.assign(new Error('missing'), { code: 'P2025' }); return this.rows.splice(i, 1)[0]; }
  async upsert(a: { where: Row; create: Row; update: Row }) { const r = this.find(a.where); if (r) { Object.assign(r, a.update); return { ...r }; } return this.create({ data: a.create }); }
}

export class FakeDb {
  user = new Table(this, 'user');
  refreshToken = new Table(this, 'refreshToken');
  booking = new Table(this, 'booking');
  experience = new Table(this, 'experience');
  trip = new Table(this, 'trip');
  notification = new Table(this, 'notification');
  auditLog = new Table(this, 'auditLog');
  travelerProfile = new Table(this, 'travelerProfile');
  hostProfile = new Table(this, 'hostProfile');
  review = new Table(this, 'review');
  message = new Table(this, 'message');
  itineraryItem = new Table(this, 'itineraryItem');
  destination = new Table(this, 'destination');
  calls: Array<{ table: string; op: string; args: any }> = [];
  failNextCreate: string | null = null;
  failNextUpdateMany: string | null = null;

  defaults(table: string): Row {
    if (table === 'booking') return { status: 'REQUESTED', guests: 1, expiresAt: null, tripId: null, note: null };
    if (table === 'refreshToken') return { revokedAt: null, replacedById: null };
    if (table === 'notification') return { readAt: null };
    return {};
  }
  // Relation emulation for the few includes/selects the services use.
  shape(name: string, row: Row, a: { select?: Row; include?: Row }): Row {
    const out = pick(row, a.select);
    if (name === 'experience' && a.include?.host) {
      const host = this.hostProfile.rows.find((h) => h.id === row.hostProfileId);
      const user = host ? this.user.rows.find((u) => u.id === host.userId) : null;
      out.host = host ? { ...host, user: user ? { status: user.status } : null } : null;
    }
    if (name === 'user' && a.select) {
      if (a.select.travelerProfile) out.travelerProfile = this.pickRel(this.travelerProfile.rows.find((t) => t.userId === row.id), a.select.travelerProfile);
      if (a.select.hostProfile) {
        const h = this.hostProfile.rows.find((x) => x.userId === row.id);
        out.hostProfile = this.pickRel(h, a.select.hostProfile);
        const ex = a.select.hostProfile?.select?.experiences;
        if (h && ex) out.hostProfile.experiences = this.experience.rows.filter((e) => e.hostProfileId === h.id && matches(e, ex.where)).map((e) => pick(e, ex.select));
      }
    }
    return out;
  }
  private pickRel(r: Row | undefined, sel: any) { return r ? (sel === true ? { ...r } : pick(r, sel.select)) : null; }
  async $transaction<T>(fn: (tx: FakeDb) => Promise<T>, _opts?: unknown): Promise<T> { return fn(this); }
}
