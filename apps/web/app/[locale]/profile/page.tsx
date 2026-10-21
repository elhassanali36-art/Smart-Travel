'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { detailedErrorText, errorText } from '../../../lib/errors';
import { fmt } from '../../../lib/i18n';
import { parseList } from '../../../lib/lists';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

type Traveler = { bio?: string | null; country?: string | null; languages?: string[]; interests?: string[]; budgetLevel?: number | null; completion?: number };
type Me = { name: string; role: string; travelerProfile?: Traveler | null };

export default function Profile() {
  const { locale, t } = useI18n();
  const gate = useAuthGate();
  const [me, setMe] = useState<Me | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [f, setF] = useState({ bio: '', country: '', languages: '', interests: '', budgetLevel: 3 });
  const [completion, setCompletion] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (gate !== 'ready') return;
    api<Me>('/profiles/me', { auth: true }).then((x) => {
      setMe(x);
      const p = x.travelerProfile;
      if (p) { setF({ bio: p.bio ?? '', country: p.country ?? '', languages: (p.languages ?? []).join(', '), interests: (p.interests ?? []).join(', '), budgetLevel: p.budgetLevel ?? 3 }); setCompletion(p.completion ?? 0); }
    }).catch((e) => setLoadErr(errorText(e, t.errors)));
  }, [gate, t]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      // Only editable fields are sent; the API rejects unknown properties (id, userId, completion, ...).
      const body = { bio: f.bio.trim() || null, country: f.country.trim() || null, languages: parseList(f.languages), interests: parseList(f.interests), budgetLevel: Number(f.budgetLevel) };
      const x = await api<Traveler>('/profiles/me/traveler', { method: 'PUT', auth: true, body: JSON.stringify(body) });
      setCompletion(x.completion ?? 0);
      setMsg({ ok: true, text: t.common.saved });
    } catch (e2) { setMsg({ ok: false, text: detailedErrorText(e2, t.errors, locale) }); }
    finally { setBusy(false); }
  }

  if (gate === 'loading') return <main className="dash"><p className="muted">{t.common.loading}</p></main>;
  if (gate === 'anon') return <main className="dash"><LoginPrompt /></main>;
  return (
    <main className="dash">
      <h1>{t.profile.title}</h1>
      {loadErr && <p className="error" role="alert">{loadErr}</p>}
      {me && <p className="muted">{me.name} · {t.roles[me.role as keyof typeof t.roles] ?? me.role}</p>}
      {me?.role === 'LOCAL_HOST' && <p className="muted">{t.profile.hostNote} <Link href={`/${locale}/host`}>{t.nav.host}</Link></p>}
      <form className="form" style={{ margin: '30px 0' }} onSubmit={save}>
        <h2>{t.profile.traveler}</h2>
        <p className="muted">{fmt(t.profile.completion, { n: completion })}</p>
        {msg && <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
        <label className="field">{t.profile.bio}<textarea value={f.bio} maxLength={1000} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
        <label className="field">{t.profile.country}<input value={f.country} maxLength={100} onChange={(e) => setF({ ...f, country: e.target.value })} /></label>
        <label className="field">{t.profile.languages}<input value={f.languages} dir="ltr" onChange={(e) => setF({ ...f, languages: e.target.value })} /></label>
        <label className="field">{t.profile.interests}<input value={f.interests} onChange={(e) => setF({ ...f, interests: e.target.value })} /></label>
        <label className="field">{t.profile.budget}<input type="number" min={1} max={5} value={f.budgetLevel} onChange={(e) => setF({ ...f, budgetLevel: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} /></label>
        <button className="btn" disabled={busy}>{busy ? t.common.saving : t.common.save}</button>
      </form>
    </main>
  );
}
