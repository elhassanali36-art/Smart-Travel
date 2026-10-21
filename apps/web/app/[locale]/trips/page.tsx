'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { detailedErrorText, errorText } from '../../../lib/errors';
import { fmt } from '../../../lib/i18n';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

type Trip = { id: string; title: string; status: string; destination?: { nameEn: string; nameAr: string } | null; itineraryItems: { id: string; dayNumber: number; title: string }[]; bookings: unknown[] };

export default function Trips() {
  const { locale, t } = useI18n();
  const ar = locale === 'ar';
  const gate = useAuthGate();
  const [data, setData] = useState<Trip[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState('');
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setData(await api<Trip[]>('/trips', { auth: true })); }
    catch (e) { setError(errorText(e, t.errors)); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { if (gate === 'ready') void load(); }, [gate, load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try { await api('/trips', { method: 'POST', auth: true, body: JSON.stringify({ title: title.trim() }) }); setTitle(''); await load(); }
    catch (e2) { setError(detailedErrorText(e2, t.errors, locale)); }
    finally { setBusy(false); }
  }
  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || busy) return;
    setError(''); setBusy(true);
    try { await api(`/trips/${selectedId}/itinerary`, { method: 'POST', auth: true, body: JSON.stringify({ dayNumber: day, title: itemTitle.trim() }) }); setItemTitle(''); await load(); }
    catch (e2) { setError(detailedErrorText(e2, t.errors, locale)); }
    finally { setBusy(false); }
  }

  const selected = data.find((x) => x.id === selectedId) ?? null;
  if (gate === 'loading') return <main className="dash"><p className="muted">{t.common.loading}</p></main>;
  if (gate === 'anon') return <main className="dash"><LoginPrompt /></main>;
  return (
    <main className="dash">
      <h1>{t.trips.title}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="form" onSubmit={create} style={{ margin: '20px 0' }}>
        <label className="field">{t.trips.tripTitle}<input value={title} required maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <button className="btn" disabled={busy}>{t.trips.create}</button>
      </form>
      {loading && <p className="muted">{t.common.loading}</p>}
      <div className="grid">
        {data.map((x) => (
          <article className="card" key={x.id}>
            <span className="badge">{x.status}</span><h3>{x.title}</h3>
            <p className="muted">{x.destination ? (ar ? x.destination.nameAr : x.destination.nameEn) : t.trips.flexible}</p>
            <small>{fmt(t.trips.counts, { items: x.itineraryItems.length, bookings: x.bookings.length })}</small>
            <button className="btn alt" style={{ marginTop: 14 }} onClick={() => setSelectedId(x.id)}>{t.trips.manage}</button>
          </article>
        ))}
        {!loading && !error && !data.length && <article className="card"><p className="muted">{t.trips.empty}</p></article>}
      </div>
      {selected && (
        <section className="form" style={{ margin: '30px 0' }}>
          <h2>{fmt(t.trips.itineraryOf, { title: selected.title })}</h2>
          {selected.itineraryItems.map((i) => <p className="card" key={i.id}>{fmt(t.trips.dayN, { n: i.dayNumber })}: {i.title}</p>)}
          <form onSubmit={addItem}>
            <label className="field">{t.trips.day}<input type="number" min={1} max={366} value={day} onChange={(e) => setDay(Math.min(366, Math.max(1, Number(e.target.value) || 1)))} /></label>
            <label className="field">{t.trips.newItem}<input value={itemTitle} required maxLength={200} onChange={(e) => setItemTitle(e.target.value)} /></label>
            <button className="btn" disabled={busy}>{t.trips.add}</button>
          </form>
        </section>
      )}
    </main>
  );
}
