'use client';
import { useCallback, useEffect, useState } from 'react';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { errorText } from '../../../lib/errors';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

type N = { id: string; type: string; title: string; body: string; readAt: string | null };

export default function Notifications() {
  const { t } = useI18n();
  const gate = useAuthGate();
  const [data, setData] = useState<N[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setData(await api<N[]>('/notifications', { auth: true })); setErr(''); }
    catch (e) { setErr(errorText(e, t.errors)); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { if (gate === 'ready') void load(); }, [gate, load]);

  async function read(id: string) {
    try { await api(`/notifications/${id}/read`, { method: 'POST', auth: true }); await load(); }
    catch (e) { setErr(errorText(e, t.errors)); }
  }

  if (gate === 'loading') return <main className="dash"><p className="muted">{t.common.loading}</p></main>;
  if (gate === 'anon') return <main className="dash"><LoginPrompt /></main>;
  return (
    <main className="dash">
      <h1>{t.notifications.title}</h1>
      {err && <p className="error" role="alert">{err}</p>}
      {loading && <p className="muted">{t.common.loading}</p>}
      <div className="grid">
        {data.map((n) => (
          <article className="card" key={n.id}>
            <span className="badge">{n.type}</span><h3>{n.title}</h3><p className="muted">{n.body}</p>
            {!n.readAt && <button className="btn alt" onClick={() => void read(n.id)}>{t.notifications.markRead}</button>}
          </article>
        ))}
        {!loading && !err && !data.length && <article className="card"><p className="muted">{t.notifications.empty}</p></article>}
      </div>
    </main>
  );
}
