'use client';
import { useEffect, useState } from 'react';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { api } from '../../../lib/api';
import { errorText } from '../../../lib/errors';
import { fmt } from '../../../lib/i18n';
import { useAuthGate } from '../../../lib/use-auth-gate';
import { useI18n } from '../../../lib/use-i18n';

type Match = { id: string; name: string; city: string | null; score: number; explanation: { sharedInterests: number; sharedLanguages: number } };

export default function MatchPage() {
  const { t } = useI18n();
  const gate = useAuthGate();
  const [data, setData] = useState<Match[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (gate !== 'ready') return;
    api<Match[]>('/matching/hosts', { auth: true }).then(setData).catch((e) => setErr(errorText(e, t.errors))).finally(() => setLoading(false));
  }, [gate, t]);

  return (
    <main className="dash">
      <h1>{t.match.title}</h1>
      <p className="muted">{t.match.subtitle}</p>
      {gate === 'anon' && <LoginPrompt />}
      {(gate === 'loading' || (gate === 'ready' && loading)) && <p className="muted">{t.common.loading}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="grid">
        {data.map((x) => (
          <article className="card" key={x.id}>
            <span className="badge">{x.score}/100</span><h3>{x.name}</h3><p className="muted">{x.city}</p>
            <small>{fmt(t.match.shared, { interests: x.explanation.sharedInterests, languages: x.explanation.sharedLanguages })}</small>
          </article>
        ))}
        {gate === 'ready' && !loading && !err && !data.length && <article className="card"><p className="muted">{t.match.empty}</p></article>}
      </div>
    </main>
  );
}
