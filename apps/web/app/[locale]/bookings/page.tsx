'use client';
import { useCallback, useEffect, useState } from 'react';
import { BookingCard, Booking } from '../../../components/BookingCard';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { errorText } from '../../../lib/errors';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

export default function Bookings() {
  const { t } = useI18n();
  const gate = useAuthGate();
  const [data, setData] = useState<Booking[]>([]);
  const [role, setRole] = useState<string>('TRAVELER');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([api<{ role: string }>('/auth/me', { auth: true }), api<Booking[]>('/bookings', { auth: true })]);
      setRole(me.role);
      setData(list);
      setErr('');
    } catch (e) { setErr(errorText(e, t.errors)); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { if (gate === 'ready') void load(); }, [gate, load]);

  if (gate === 'loading') return <main className="dash"><p className="muted">{t.common.loading}</p></main>;
  if (gate === 'anon') return <main className="dash"><LoginPrompt /></main>;
  return (
    <main className="dash">
      <h1>{t.booking.title}</h1>
      {err && <p className="error" role="alert">{err} <button className="btn alt" onClick={() => void load()}>{t.common.retry}</button></p>}
      {loading && <p className="muted">{t.common.loading}</p>}
      <div className="grid">
        {data.map((b) => <BookingCard key={b.id} b={b} role={role === 'LOCAL_HOST' ? 'HOST' : 'TRAVELER'} onChanged={() => void load()} />)}
        {!loading && !err && !data.length && <article className="card"><p className="muted">{t.booking.empty}</p></article>}
      </div>
    </main>
  );
}
