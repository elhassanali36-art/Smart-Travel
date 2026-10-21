'use client';
import Link from 'next/link';
import { useI18n } from '../lib/use-i18n';

export function LoginPrompt() {
  const { locale, t } = useI18n();
  return (
    <div className="card">
      <p className="muted">{t.errors.loginRequired}</p>
      <Link className="btn" href={`/${locale}/login`}>{t.errors.goLogin}</Link>
    </div>
  );
}
