'use client';
import { FormEvent, useState } from 'react';
import { api, ensureAccessToken } from '../lib/api';
import { detailedErrorText } from '../lib/errors';
import { useI18n } from '../lib/use-i18n';

export function BookButton({ experienceId, capacity }: { experienceId: string; capacity: number }) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [guests, setGuests] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!(await ensureAccessToken())) return setMsg({ ok: false, text: t.booking.loginFirst });
    setBusy(true);
    setMsg(null);
    try {
      // datetime-local has no zone: the browser's local time becomes an absolute ISO instant.
      await api('/bookings', { method: 'POST', auth: true, body: JSON.stringify({ experienceId, startsAt: new Date(startsAt).toISOString(), guests }) });
      setMsg({ ok: true, text: t.booking.sent });
      setOpen(false);
    } catch (err) {
      setMsg({ ok: false, text: detailedErrorText(err, t.errors, locale) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && <button className="btn" onClick={() => setOpen(true)}>{t.booking.bookNow}</button>}
      {open && (
        <form onSubmit={submit}>
          <label className="field">{t.booking.startsAt}<input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
          <label className="field">{t.booking.guests}<input type="number" min={1} max={capacity} required value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} /></label>
          <button className="btn" disabled={busy}>{t.booking.submit}</button>
        </form>
      )}
      {msg && <small className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'} style={{ display: 'block', marginTop: 8 }}>{msg.text}</small>}
    </>
  );
}
