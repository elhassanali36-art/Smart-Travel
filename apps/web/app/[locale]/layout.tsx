import '../globals.css';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Nav } from '../../components/Nav';
import { dirOf, isLocale, locales } from '../../lib/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>
        <div className="shell">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
