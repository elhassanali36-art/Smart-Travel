'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { detailedErrorText, errorText } from '../../../lib/errors';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

type M = { id: string; body: string; createdAt: string; sender?: { name: string }; recipient?: { name: string } };

export default function Messages() {
  const { locale, t } = useI18n();
  const gate = useAuthGate();
  const [data, setData] = useState<M[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setData(await api<M[]>('/messages', { auth: true })); }
    catch (e) { setErr(errorText(e, t.errors)); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { if (gate === 'ready') void load(); }, [gate, load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try { await api('/messages', { method: 'POST', auth: true, body: JSON.stringify({ recipientId: recipientId.trim(), body }) }); setBody(''); await load(); }
    catch (e2) { setErr(detailedErrorText(e2, t.errors, locale)); }
    finally { setBusy(false); }
  }

  if (gate === 'loading') return <main className="dash"><p className="muted">{t.common.loading}</p></main>;
  if (gate === 'anon') return <main className="dash"><LoginPrompt /></main>;
  return (
    <main className="dash">
      <h1>{t.messages.title}</h1>
      {err && <p className="error" role="alert">{err}</p>}
      <form className="form" onSubmit={send}>
        <label className="field">{t.messages.recipientId}<input value={recipientId} dir="ltr" required onChange={(e) => setRecipientId(e.target.value)} /></label>
        <label className="field">{t.messages.message}<textarea value={body} maxLength={4000} required onChange={(e) => setBody(e.target.value)} /></label>
        <button className="btn" disabled={busy}>{t.messages.send}</button>
      </form>
      <div className="grid">
        {data.map((m) => (
          <article className="card" key={m.id}>
            <b>{m.sender?.name}{m.recipient ? ` → ${m.recipient.name}` : ''}</b>
            <p className="muted">{m.body}</p>
            <small className="muted">{new Date(m.createdAt).toLocaleString(locale === 'ar' ? 'ar' : 'en')}</small>
          </article>
        ))}
        {!loading && !err && !data.length && <article className="card"><p className="muted">{t.messages.empty}</p></article>}
      </div>
    </main>
  );
}
