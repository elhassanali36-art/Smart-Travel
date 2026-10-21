'use client';
import { useCallback, useEffect, useState } from 'react';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { errorText } from '../../../lib/errors';
import { fmt } from '../../../lib/i18n';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

type User = { id: string; name: string; email?: string | null; role: string; status: string };
type Dispute = { id: string; disputeReason: string | null; experience: { titleEn: string; titleAr: string }; traveler: { name: string }; host: { name: string } };
const ROLES = ['TRAVELER', 'LOCAL_HOST', 'ADMIN'] as const;
const STATUSES = ['ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING'] as const;

export default function Admin() {
  const { locale, t } = useI18n();
  const ar = locale === 'ar';
  const gate = useAuthGate();
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [overview, analytics, list, d] = await Promise.all([
        api<Record<string, unknown>>('/admin/overview', { auth: true }), api<Record<string, unknown>>('/analytics/summary', { auth: true }),
        api<User[]>('/admin/users', { auth: true }), api<Dispute[]>('/bookings/disputes', { auth: true }),
      ]);
      setStats({ ...overview, ...analytics }); setUsers(list); setDisputes(d); setErr('');
    } catch (e) { setErr(errorText(e, t.errors)); }
  }, [t]);
  useEffect(() => { if (gate === 'ready') void load(); }, [gate, load]);

  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setInfo('');
    try { await fn(); await load(); } catch (e) { setErr(errorText(e, t.errors)); } finally { setBusy(false); }
  }
  const update = (id: string, field: 'role' | 'status', value: string) => act(() => api(`/admin/users/${id}/${field}`, { method: 'PATCH', auth: true, body: JSON.stringify({ [field]: value }) }));
  const resolve = (id: string, outcome: 'COMPLETED' | 'CANCELLED') => act(() => api(`/bookings/${id}/resolve`, { method: 'POST', auth: true, body: JSON.stringify({ outcome, note: (notes[id] ?? '').trim() }) }));
  const expire = () => act(async () => { const r = await api<{ expired: number }>('/bookings/expire-overdue', { method: 'POST', auth: true }); setInfo(fmt(t.admin.expired, { n: r.expired })); });

  if (gate === 'loading') return <main className="dash"><p className="muted">{t.common.loading}</p></main>;
  if (gate === 'anon') return <main className="dash"><LoginPrompt /></main>;
  return (
    <main className="dash">
      <h1>{t.admin.title}</h1>
      {err && <p className="error" role="alert">{err}</p>}
      {info && <p className="success" role="status">{info}</p>}
      <div className="grid">{Object.entries(stats).map(([k, v]) => <article className="card" key={k}><small className="muted">{k}</small><div className="stat">{String(v)}</div></article>)}</div>

      <section className="section" style={{ paddingInline: 0 }}>
        <h2>{t.admin.disputes}</h2>
        <button className="btn alt" disabled={busy} onClick={() => void expire()}>{t.admin.expire}</button>
        <div className="grid">
          {disputes.map((d) => (
            <article className="card" key={d.id}>
              <h3>{ar ? d.experience.titleAr : d.experience.titleEn}</h3>
              <p className="muted">{d.traveler.name} ↔ {d.host.name}</p>
              <p>{d.disputeReason}</p>
              <label className="field">{t.admin.note}<textarea value={notes[d.id] ?? ''} minLength={2} maxLength={2000} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} /></label>
              <div className="actions">
                <button className="btn" disabled={busy || (notes[d.id] ?? '').trim().length < 2} onClick={() => void resolve(d.id, 'COMPLETED')}>{t.admin.resolveCompleted}</button>
                <button className="btn alt" disabled={busy || (notes[d.id] ?? '').trim().length < 2} onClick={() => void resolve(d.id, 'CANCELLED')}>{t.admin.resolveCancelled}</button>
              </div>
            </article>
          ))}
          {!disputes.length && <article className="card"><p className="muted">{t.admin.noDisputes}</p></article>}
        </div>
      </section>

      <section className="section" style={{ paddingInline: 0 }}>
        <h2>{t.admin.users}</h2>
        <div className="grid">
          {users.map((u) => (
            <article className="card" key={u.id}>
              <h3>{u.name}</h3><small>{u.email ?? '—'}</small>
              <label className="field">{t.admin.role}<select value={u.role} disabled={busy} onChange={(e) => void update(u.id, 'role', e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</select></label>
              <label className="field">{t.admin.status}<select value={u.status} disabled={busy} onChange={(e) => void update(u.id, 'status', e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{t.userStatus[s]}</option>)}</select></label>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
