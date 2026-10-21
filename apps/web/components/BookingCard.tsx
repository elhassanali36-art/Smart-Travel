'use client';
import { useState } from 'react';
import { api } from '../lib/api';
import { detailedErrorText } from '../lib/errors';
import { fmt } from '../lib/i18n';
import { useI18n } from '../lib/use-i18n';

export type Booking = {
  id: string; status: string; startsAt: string; endsAt: string; guests: number; expiresAt: string | null; disputeReason?: string | null;
  experience: { titleEn: string; titleAr: string }; traveler: { name: string }; host: { name: string };
};

// Buttons only reflect what the server will accept (the API remains the authority).
export function BookingCard({ b, role, onChanged }: { b: Booking; role: 'TRAVELER' | 'HOST'; onChanged: () => void }) {
  const { locale, t } = useI18n();
  const ar = locale === 'ar';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const now = Date.now();
  const started = new Date(b.startsAt).getTime() <= now;
  const ended = new Date(b.endsAt).getTime() <= now;
  const traveler = role === 'TRAVELER';

  async function run(fn: () => Promise<unknown>, okText?: string) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try { await fn(); if (okText) setMsg({ ok: true, text: okText }); onChanged(); }
    catch (e) { setMsg({ ok: false, text: detailedErrorText(e, t.errors, locale) }); }
    finally { setBusy(false); }
  }
  const to = (status: string) => run(() => api(`/bookings/${b.id}/status/${status}`, { method: 'POST', auth: true }));

  return (
    <article className="card">
      <span className="badge">{t.booking.status[b.status as keyof typeof t.booking.status] ?? b.status}</span>
      <h3>{ar ? b.experience.titleAr : b.experience.titleEn}</h3>
      <p className="muted">{traveler ? `${t.booking.host}: ${b.host.name}` : `${t.booking.traveler}: ${b.traveler.name}`}</p>
      <p className="muted">{t.booking.when}: {new Date(b.startsAt).toLocaleString(ar ? 'ar' : 'en')} · {fmt(t.booking.guestsN, { n: b.guests })}</p>
      {b.expiresAt && (b.status === 'REQUESTED' || b.status === 'ACCEPTED') && <small className="muted">{t.booking.expiresAt}: {new Date(b.expiresAt).toLocaleString(ar ? 'ar' : 'en')}</small>}
      {b.status === 'DISPUTED' && <p className="muted">{t.booking.disputed} {b.disputeReason}</p>}

      <div className="actions">
        {!traveler && b.status === 'REQUESTED' && <><button className="btn" disabled={busy} onClick={() => to('ACCEPTED')}>{t.booking.accept}</button><button className="btn alt" disabled={busy} onClick={() => to('REJECTED')}>{t.booking.reject}</button></>}
        {traveler && b.status === 'ACCEPTED' && !started && <button className="btn" disabled={busy} onClick={() => to('CONFIRMED')}>{t.booking.confirm}</button>}
        {((traveler && ['REQUESTED', 'ACCEPTED', 'CONFIRMED'].includes(b.status)) || (!traveler && ['ACCEPTED', 'CONFIRMED'].includes(b.status))) && !started && <button className="btn alt" disabled={busy} onClick={() => to('CANCELLED')}>{t.booking.cancel}</button>}
        {b.status === 'CONFIRMED' && ended && <button className="btn" disabled={busy} onClick={() => to('COMPLETED')}>{t.booking.complete}</button>}
        {((b.status === 'CONFIRMED' && started) || b.status === 'COMPLETED') && <button className="btn alt" disabled={busy} onClick={() => setDisputing((v) => !v)}>{t.booking.dispute}</button>}
        {traveler && b.status === 'COMPLETED' && <button className="btn" disabled={busy} onClick={() => setReviewing((v) => !v)}>{t.booking.leaveReview}</button>}
      </div>

      {disputing && (
        <form onSubmit={(e) => { e.preventDefault(); void run(() => api(`/bookings/${b.id}/dispute`, { method: 'POST', auth: true, body: JSON.stringify({ reason: reason.trim() }) })); }}>
          <label className="field">{t.booking.disputeReason}<textarea value={reason} minLength={10} maxLength={2000} required onChange={(e) => setReason(e.target.value)} /></label>
          <button className="btn" disabled={busy}>{t.booking.submitDispute}</button>
        </form>
      )}
      {reviewing && (
        <form onSubmit={(e) => { e.preventDefault(); void run(() => api(`/reviews/${b.id}`, { method: 'POST', auth: true, body: JSON.stringify({ rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }) }), t.booking.reviewSent); }}>
          <label className="field">{t.booking.rating}<input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Math.min(5, Math.max(1, Number(e.target.value) || 1)))} /></label>
          <label className="field">{t.booking.comment}<textarea value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} /></label>
          <button className="btn" disabled={busy}>{t.booking.submitReview}</button>
        </form>
      )}
      {msg && <small className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</small>}
    </article>
  );
}
