'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasSessionHint, logoutRequest } from '../lib/api';
import { getDict, isLocale } from '../lib/i18n';

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const seg = path.split('/')[1] ?? 'en';
  const locale = isLocale(seg) ? seg : 'en';
  const t = getDict(locale).nav;
  const rest = path.split('/').slice(2).join('/');
  const other = locale === 'en' ? 'ar' : 'en';
  const [authed, setAuthed] = useState(false);
  // Read after mount (not during render) so server and client markup match.
  useEffect(() => { setAuthed(hasSessionHint()); }, [path]);

  async function logout() {
    await logoutRequest();
    setAuthed(false);
    router.push(`/${locale}/login`);
  }

  return (
    <nav className="nav">
      <Link className="brand" href={`/${locale}`}>Smart Travel</Link>
      <div className="navlinks">
        <Link href={`/${locale}/discover`}>{t.discover}</Link>
        <Link href={`/${locale}/match`}>{t.match}</Link>
        <Link href={`/${locale}/assistant`}>{t.assistant}</Link>
        <Link href={`/${locale}/trips`}>{t.trips}</Link>
        <Link href={`/${locale}/bookings`}>{t.bookings}</Link>
        <Link href={`/${locale}/messages`}>{t.messages}</Link>
        <Link href={`/${locale}/notifications`}>{t.notifications}</Link>
        {authed ? (
          <>
            <Link href={`/${locale}/profile`}>{t.profile}</Link>
            <Link href={`/${locale}/host`}>{t.host}</Link>
            <a href="#logout" onClick={(e) => { e.preventDefault(); void logout(); }}>{t.logout}</a>
          </>
        ) : (
          <Link href={`/${locale}/login`}>{t.login}</Link>
        )}
        <Link href={`/${other}${rest ? `/${rest}` : ''}`} hrefLang={other}>{t.language}</Link>
      </div>
    </nav>
  );
}
