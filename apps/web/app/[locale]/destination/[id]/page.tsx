import Link from 'next/link';
import { BookButton } from '../../../../components/BookButton';
import { api } from '../../../../lib/api';
import { fmt, getDict } from '../../../../lib/i18n';

type Experience = { id: string; titleEn: string; titleAr: string; descriptionEn: string; descriptionAr: string; priceCents: number; durationMinutes: number; capacity: number; languages: string[] };
type Dest = { nameEn: string; nameAr: string; countryEn: string; countryAr: string; descriptionEn: string; descriptionAr: string; experiences: Experience[] };

export default async function Destination({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ar = locale === 'ar';
  const t = getDict(locale);
  let d: Dest | null = null;
  try { d = await api<Dest>(`/destinations/${id}`); } catch { /* unavailable */ }
  if (!d) return <main className="section"><h1>{t.destination.unavailable}</h1><Link className="btn alt" href={`/${locale}/discover`}>{t.common.back}</Link></main>;
  return (
    <main className="section">
      <span className="badge">{ar ? d.countryAr : d.countryEn}</span>
      <h1>{ar ? d.nameAr : d.nameEn}</h1>
      <p className="muted">{ar ? d.descriptionAr : d.descriptionEn}</p>
      <h2>{t.destination.experiences}</h2>
      <div className="grid">
        {d.experiences.map((x) => (
          <article className="card" key={x.id}>
            <h3>{ar ? x.titleAr : x.titleEn}</h3>
            <p className="muted">{ar ? x.descriptionAr : x.descriptionEn}</p>
            <b>${(x.priceCents / 100).toFixed(2)}</b>
            <p><small>{fmt(t.destination.minutes, { n: x.durationMinutes })} · {x.languages.join(', ')}</small></p>
            <BookButton experienceId={x.id} capacity={x.capacity} />
          </article>
        ))}
        {!d.experiences.length && <article className="card"><p className="muted">{t.destination.noExperiences}</p></article>}
      </div>
      <p><Link className="btn alt" href={`/${locale}/discover`}>{t.common.back}</Link></p>
    </main>
  );
}
