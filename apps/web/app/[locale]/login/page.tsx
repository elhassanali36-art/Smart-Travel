'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { login } from '../../../lib/api';
import { detailedErrorText } from '../../../lib/errors';
import { useI18n } from '../../../lib/use-i18n';

export default function Login() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const id = identifier.trim();
      // One field accepts an email or a phone number; the API takes them as separate fields.
      await login(id.includes('@') ? { email: id, password } : { phone: id, password });
      router.push(`/${locale}/profile`);
    } catch (e2) {
      setErr(detailedErrorText(e2, t.errors, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="form">
      <h1>{t.auth.loginTitle}</h1>
      {err && <p className="error" role="alert">{err}</p>}
      <form onSubmit={submit}>
        <label className="field">{t.auth.emailOrPhone}<input value={identifier} required autoComplete="username" dir="ltr" onChange={(e) => setIdentifier(e.target.value)} /></label>
        <label className="field">{t.auth.password}<input type="password" value={password} required autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn" disabled={busy}>{t.auth.login}</button>
      </form>
      <p className="muted"><Link href={`/${locale}/register`}>{t.auth.createAccount}</Link></p>
    </main>
  );
}
