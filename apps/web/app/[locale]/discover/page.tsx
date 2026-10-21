import Link from 'next/link';
import { api } from '../../../lib/api';
import { getDict } from '../../../lib/i18n';

type D = { id: string; nameEn: string; nameAr: string; countryEn: string; countryAr: string; descriptionEn: string; descriptionAr: string; tags: string[] };

export default async function Discover({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ar = locale === 'ar';
  const t = getDict(locale).discover;
  let data: D[] = [];
  try { data = await api<D[]>('/destinations'); } catch { /* shown as the empty state */ }
  return (
    <main className="section">
      <div className="eyebrow">{t.eyebrow}</div>
      <h1>{t.title}</h1>
      <p className="muted">{t.subtitle}</p>
      <div className="grid">
        {data.map((d) => (
          <Link className="card" href={`/${locale}/destination/${d.id}`} key={d.id}>
            <span className="badge">{ar ? d.countryAr : d.countryEn}</span>
            <h3>{ar ? d.nameAr : d.nameEn}</h3>
            <p className="muted">{ar ? d.descriptionAr : d.descriptionEn}</p>
            <small>{d.tags.join(' · ')}</small>
          </Link>
        ))}
      </div>
      {!data.length && <div className="card"><p className="muted">{t.empty}</p></div>}
    </main>
  );
}
