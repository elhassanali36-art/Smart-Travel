import Link from 'next/link';
import { getDict } from '../../lib/i18n';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDict(locale).home;
  return (
    <>
      <main>
        <section className="hero">
          <div className="eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <div className="actions">
            <Link className="btn" href={`/${locale}/discover`}>{t.start}</Link>
            <Link className="btn alt" href={`/${locale}/register`}>{t.create}</Link>
          </div>
        </section>
        <section className="section">
          <div className="grid">
            {([['f1t', 'f1d'], ['f2t', 'f2d'], ['f3t', 'f3d']] as const).map(([h, d]) => (
              <article className="card" key={h}><h3>{t[h]}</h3><p className="muted">{t[d]}</p></article>
            ))}
          </div>
        </section>
      </main>
      <footer className="footer">{t.footer}</footer>
    </>
  );
}
