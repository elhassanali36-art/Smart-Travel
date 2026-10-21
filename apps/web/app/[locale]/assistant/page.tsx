'use client';
import { useState } from 'react';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { errorText } from '../../../lib/errors';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

type Answer = { text: string; items?: string[] };

export default function Assistant() {
  const { locale, t } = useI18n();
  const gate = useAuthGate();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (busy || q.trim().length < 2) return;
    setBusy(true);
    setErr('');
    try { setAnswer(await api<Answer>('/ai/recommend', { method: 'POST', auth: true, body: JSON.stringify({ prompt: q.trim(), context: { locale } }) })); }
    catch (e) { setErr(errorText(e, t.errors)); }
    finally { setBusy(false); }
  }

  if (gate === 'loading') return <main className="form"><p className="muted">{t.common.loading}</p></main>;
  if (gate === 'anon') return <main className="form"><LoginPrompt /></main>;
  return (
    <main className="form">
      <h1>{t.assistant.title}</h1>
      {err && <p className="error" role="alert">{err}</p>}
      <textarea className="field" value={q} maxLength={2000} onChange={(e) => setQ(e.target.value)} placeholder={t.assistant.placeholder} />
      <button className="btn" onClick={ask} disabled={busy}>{t.assistant.ask}</button>
      {answer && <article className="card"><p>{answer.text}</p><ul>{answer.items?.map((x) => <li key={x}>{x}</li>)}</ul></article>}
    </main>
  );
}
