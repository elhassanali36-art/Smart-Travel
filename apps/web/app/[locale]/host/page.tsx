'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BookingCard, Booking } from '../../../components/BookingCard';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { detailedErrorText, errorText } from '../../../lib/errors';
import { fmt } from '../../../lib/i18n';
import { parseList } from '../../../lib/lists';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

type HostProfile = { bio?: string | null; city?: string | null; country?: string | null; languages?: string[]; expertise?: string[]; categories?: string[]; availabilityNote?: string | null; verification?: string; completion?: number };
type Me = { role: string; hostProfile?: HostProfile | null };
type Exp = { id: string; titleEn: string; titleAr: string; descriptionEn: string; descriptionAr: string; category: string; priceCents: number; durationMinutes: number; capacity: number; languages: string[]; tags: string[]; active: boolean; destinationId: string };
type Dest = { id: string; nameEn: string; nameAr: string };
const emptyExp = { titleEn: '', titleAr: '', descriptionEn: '', descriptionAr: '', category: '', price: '0', durationMinutes: 120, capacity: 4, languages: 'ar, en', tags: '', destinationId: '' };

export default function Host() {
  const { locale, t } = useI18n();
  const ar = locale === 'ar';
  const gate = useAuthGate();
  const [me, setMe] = useState<Me | null>(null);
  const [exps, setExps] = useState<Exp[]>([]);
  const [dests, setDests] = useState<Dest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [ef, setEf] = useState(emptyExp);
  const [pf, setPf] = useState({ bio: '', city: '', country: '', languages: '', expertise: '', categories: '', availabilityNote: '' });

  const isHost = me?.role === 'LOCAL_HOST' || me?.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const m = await api<Me>('/profiles/me', { auth: true });
      setMe(m);
      const h = m.hostProfile;
      if (h) setPf({ bio: h.bio ?? '', city: h.city ?? '', country: h.country ?? '', languages: (h.languages ?? []).join(', '), expertise: (h.expertise ?? []).join(', '), categories: (h.categories ?? []).join(', '), availabilityNote: h.availabilityNote ?? '' });
      if (m.role === 'LOCAL_HOST' || m.role === 'ADMIN') {
        const [e, d, b] = await Promise.all([api<Exp[]>('/experiences/mine', { auth: true }), api<Dest[]>('/destinations?take=100'), api<Booking[]>('/bookings', { auth: true })]);
        setExps(e); setDests(d); setBookings(b);
      }
      setErr('');
    } catch (e) { setErr(errorText(e, t.errors)); }
  }, [t]);
  useEffect(() => { if (gate === 'ready') void load(); }, [gate, load]);

  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: t.common.saved }); await load(); }
    catch (e) { setMsg({ ok: false, text: detailedErrorText(e, t.errors, locale) }); }
    finally { setBusy(false); }
  }

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    void act(() => api('/profiles/me/host', { method: 'PUT', auth: true, body: JSON.stringify({
      bio: pf.bio.trim() || null, city: pf.city.trim() || null, country: pf.country.trim() || null, availabilityNote: pf.availabilityNote.trim() || null,
      languages: parseList(pf.languages), expertise: parseList(pf.expertise), categories: parseList(pf.categories),
    }) }));
  };

  function startEdit(x: Exp) {
    setEditing(x.id);
    setEf({ titleEn: x.titleEn, titleAr: x.titleAr, descriptionEn: x.descriptionEn, descriptionAr: x.descriptionAr, category: x.category, price: (x.priceCents / 100).toFixed(2), durationMinutes: x.durationMinutes, capacity: x.capacity, languages: x.languages.join(', '), tags: x.tags.join(', '), destinationId: x.destinationId });
  }
  const saveExperience = (e: FormEvent) => {
    e.preventDefault();
    const body = {
      titleEn: ef.titleEn.trim(), titleAr: ef.titleAr.trim(), descriptionEn: ef.descriptionEn.trim(), descriptionAr: ef.descriptionAr.trim(), category: ef.category.trim(),
      priceCents: Math.round(Number(ef.price) * 100), durationMinutes: Number(ef.durationMinutes), capacity: Number(ef.capacity), languages: parseList(ef.languages), tags: parseList(ef.tags),
    };
    void act(async () => {
      if (editing) await api(`/experiences/${editing}`, { method: 'PUT', auth: true, body: JSON.stringify(body) });
      else await api('/experiences', { method: 'POST', auth: true, body: JSON.stringify({ ...body, destinationId: ef.destinationId }) });
      setEditing(null); setEf(emptyExp);
    });
  };
  const toggle = (x: Exp) => void act(() => api(`/experiences/${x.id}`, { method: 'PUT', auth: true, body: JSON.stringify({ active: !x.active }) }));

  if (gate === 'loading') return <main className="dash"><p className="muted">{t.common.loading}</p></main>;
  if (gate === 'anon') return <main className="dash"><LoginPrompt /></main>;
  if (me && !isHost) return <main className="dash"><h1>{t.host.title}</h1><div className="card"><p className="muted">{t.host.notHost}</p></div></main>;

  const f = (k: keyof typeof ef, v: string | number) => setEf({ ...ef, [k]: v });
  return (
    <main className="dash">
      <h1>{t.host.title}</h1>
      {err && <p className="error" role="alert">{err} <button className="btn alt" onClick={() => void load()}>{t.common.retry}</button></p>}
      {msg && <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      {!me && !err && <p className="muted">{t.common.loading}</p>}

      {me && (<>
        <form className="form" style={{ margin: '20px 0' }} onSubmit={saveProfile}>
          <h2>{t.host.profile}</h2>
          <p className="muted">{t.host.verification}: {me.hostProfile?.verification === 'VERIFIED' ? t.host.verified : t.host.unverified} · {fmt(t.host.completion, { n: me.hostProfile?.completion ?? 0 })}</p>
          <label className="field">{t.host.city}<input value={pf.city} maxLength={100} onChange={(e) => setPf({ ...pf, city: e.target.value })} /></label>
          <label className="field">{t.host.country}<input value={pf.country} maxLength={100} onChange={(e) => setPf({ ...pf, country: e.target.value })} /></label>
          <label className="field">{t.host.bio}<textarea value={pf.bio} maxLength={1000} onChange={(e) => setPf({ ...pf, bio: e.target.value })} /></label>
          <label className="field">{t.host.languages}<input value={pf.languages} dir="ltr" onChange={(e) => setPf({ ...pf, languages: e.target.value })} /></label>
          <label className="field">{t.host.expertise}<input value={pf.expertise} onChange={(e) => setPf({ ...pf, expertise: e.target.value })} /></label>
          <label className="field">{t.host.categories}<input value={pf.categories} onChange={(e) => setPf({ ...pf, categories: e.target.value })} /></label>
          <label className="field">{t.host.availability}<textarea value={pf.availabilityNote} maxLength={500} onChange={(e) => setPf({ ...pf, availabilityNote: e.target.value })} /></label>
          <button className="btn" disabled={busy}>{t.host.saveProfile}</button>
        </form>

        <section className="section" style={{ paddingInline: 0 }}>
          <h2>{t.host.experiences}</h2>
          <div className="grid">
            {exps.map((x) => (
              <article className="card" key={x.id}>
                <span className="badge">{x.active ? t.host.active : t.host.inactive}</span>
                <h3>{ar ? x.titleAr : x.titleEn}</h3>
                <p className="muted">${(x.priceCents / 100).toFixed(2)} · {fmt(t.destination.minutes, { n: x.durationMinutes })} · {x.capacity}</p>
                <div className="actions"><button className="btn alt" disabled={busy} onClick={() => startEdit(x)}>{t.host.edit}</button><button className="btn" disabled={busy} onClick={() => toggle(x)}>{x.active ? t.host.deactivate : t.host.activate}</button></div>
              </article>
            ))}
            {!exps.length && <article className="card"><p className="muted">{t.host.noExperiences}</p></article>}
          </div>

          <form className="form" style={{ margin: '24px 0' }} onSubmit={saveExperience}>
            <h3>{editing ? t.host.editExperience : t.host.newExperience}</h3>
            <label className="field">{t.host.titleEn}<input value={ef.titleEn} required minLength={2} maxLength={150} onChange={(e) => f('titleEn', e.target.value)} /></label>
            <label className="field">{t.host.titleAr}<input value={ef.titleAr} required minLength={2} maxLength={150} onChange={(e) => f('titleAr', e.target.value)} /></label>
            <label className="field">{t.host.descEn}<textarea value={ef.descriptionEn} required minLength={2} maxLength={5000} onChange={(e) => f('descriptionEn', e.target.value)} /></label>
            <label className="field">{t.host.descAr}<textarea value={ef.descriptionAr} required minLength={2} maxLength={5000} onChange={(e) => f('descriptionAr', e.target.value)} /></label>
            <label className="field">{t.host.category}<input value={ef.category} required minLength={2} maxLength={50} onChange={(e) => f('category', e.target.value)} /></label>
            <label className="field">{t.host.price}<input type="number" min={0} step="0.01" value={ef.price} onChange={(e) => f('price', e.target.value)} /></label>
            <label className="field">{t.host.duration}<input type="number" min={15} max={10080} value={ef.durationMinutes} onChange={(e) => f('durationMinutes', Number(e.target.value))} /></label>
            <label className="field">{t.host.capacity}<input type="number" min={1} max={1000} value={ef.capacity} onChange={(e) => f('capacity', Number(e.target.value))} /></label>
            <label className="field">{t.host.languages}<input value={ef.languages} dir="ltr" onChange={(e) => f('languages', e.target.value)} /></label>
            <label className="field">{t.host.tags}<input value={ef.tags} onChange={(e) => f('tags', e.target.value)} /></label>
            {!editing && <label className="field">{t.host.destination}<select value={ef.destinationId} required onChange={(e) => f('destinationId', e.target.value)}><option value="">{t.host.pickDestination}</option>{dests.map((d) => <option key={d.id} value={d.id}>{ar ? d.nameAr : d.nameEn}</option>)}</select></label>}
            <div className="actions">
              <button className="btn" disabled={busy}>{editing ? t.host.update : t.host.create}</button>
              {editing && <button type="button" className="btn alt" onClick={() => { setEditing(null); setEf(emptyExp); }}>{t.common.cancel}</button>}
            </div>
          </form>
        </section>

        <section className="section" style={{ paddingInline: 0 }}>
          <h2>{t.host.requests}</h2>
          <div className="grid">
            {bookings.map((b) => <BookingCard key={b.id} b={b} role="HOST" onChanged={() => void load()} />)}
            {!bookings.length && <article className="card"><p className="muted">{t.host.noRequests}</p></article>}
          </div>
        </section>
      </>)}
    </main>
  );
}
