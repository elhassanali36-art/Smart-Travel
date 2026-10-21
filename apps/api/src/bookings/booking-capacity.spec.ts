import { canFit, computeEnd, MAX_ADVANCE_DAYS, MIN_LEAD_MINUTES, overlaps, seatsTaken, validateStart } from './booking-capacity';

const H = 3_600_000;
const t = (h: number) => new Date(Date.UTC(2026, 5, 1, 12, 0, 0) + h * H);

describe('computeEnd / overlaps', () => {
  it('adds the duration', () => { expect(computeEnd(t(0), 90).getTime()).toBe(t(1.5).getTime()); });
  it('uses half-open intervals: back-to-back sessions do not overlap', () => {
    expect(overlaps(t(0), t(2), t(2), t(4))).toBe(false);
    expect(overlaps(t(2), t(4), t(0), t(2))).toBe(false);
    expect(overlaps(t(0), t(2), t(1), t(3))).toBe(true);
    expect(overlaps(t(0), t(4), t(1), t(2))).toBe(true);
    expect(overlaps(t(0), t(1), t(5), t(6))).toBe(false);
  });
});

describe('validateStart', () => {
  const now = t(0);
  it('requires a valid date inside the booking horizon', () => {
    expect(validateStart(new Date('nope'), now)).toContain('valid');
    expect(validateStart(new Date(now.getTime() + (MIN_LEAD_MINUTES - 1) * 60000), now)).toContain('minutes');
    expect(validateStart(new Date(now.getTime() + MIN_LEAD_MINUTES * 60000), now)).toBeNull();
    expect(validateStart(new Date(now.getTime() + (MAX_ADVANCE_DAYS + 1) * 86400000), now)).toContain('days');
    expect(validateStart(t(-5), now)).not.toBeNull();
  });
});

describe('capacity', () => {
  const open = [{ startsAt: t(0), endsAt: t(2), guests: 3 }, { startsAt: t(1), endsAt: t(3), guests: 1 }];
  it('sums only overlapping bookings', () => {
    expect(seatsTaken(open, { startsAt: t(0), endsAt: t(1) })).toBe(3);
    expect(seatsTaken(open, { startsAt: t(1), endsAt: t(2) })).toBe(4);
    expect(seatsTaken(open, { startsAt: t(3), endsAt: t(5) })).toBe(0);
  });
  it('canFit respects capacity, party size and overlap', () => {
    expect(canFit(5, open, { startsAt: t(1), endsAt: t(2), guests: 1 })).toBe(true);
    expect(canFit(5, open, { startsAt: t(1), endsAt: t(2), guests: 2 })).toBe(false);
    expect(canFit(5, open, { startsAt: t(3), endsAt: t(5), guests: 5 })).toBe(true);
    expect(canFit(5, [], { startsAt: t(0), endsAt: t(1), guests: 6 })).toBe(false);
    expect(canFit(5, [], { startsAt: t(0), endsAt: t(1), guests: 0 })).toBe(false);
  });
});
