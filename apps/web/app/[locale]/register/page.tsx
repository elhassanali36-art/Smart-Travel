'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { register } from '../../../lib/api';
import { detailedErrorText } from '../../../lib/errors';
import { useI18n } from '../../../lib/use-i18n';

export default function Register() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    if (!f.email.trim() && !f.phone.trim()) return setErr(t.errors.contactRequired);
    setBusy(true);
    try {
      // Blank optional fields are omitted (the API also treats blank as absent).
      await register({ name: f.name.trim(), password: f.password, ...(f.email.trim() ? { email: f.email.trim() } : {}), ...(f.phone.trim() ? { phone: f.phone.trim() } : {}) });
      router.push(`/${locale}/profile`);
    } catch (e2) {
      setErr(detailedErrorText(e2, t.errors, locale));
    } finally {
      setBusy(false);
    }
  }

  const fields: Array<['name' | 'email' | 'phone' | 'password', string, string]> = [
    ['name', t.auth.name, 'text'], ['email', t.auth.email, 'email'], ['phone', t.auth.phone, 'tel'], ['password', t.auth.registerPassword, 'password'],
  ];
  return (
    <main className="form">
      <h1>{t.auth.registerTitle}</h1>
      <p className="muted">{t.auth.defaultTraveler}</p>
      {err && <p className="error" role="alert">{err}</p>}
      <form onSubmit={submit}>
        {fields.map(([k, label, type]) => (
          <label className="field" key={k}>{label}<input type={type} value={f[k]} required={k === 'name' || k === 'password'} minLength={k === 'password' ? 8 : undefined} maxLength={k === 'password' ? 128 : undefined} dir={k === 'name' ? undefined : 'ltr'} autoComplete={k === 'password' ? 'new-password' : undefined} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
        ))}
        <button className="btn" disabled={busy}>{t.auth.register}</button>
      </form>
      <p className="muted"><Link href={`/${locale}/login`}>{t.auth.haveAccount}</Link></p>
    </main>
  );
}
