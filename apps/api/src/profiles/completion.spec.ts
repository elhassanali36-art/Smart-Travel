import { completionOf, definedOnly, HOST_COMPLETION_KEYS, TRAVELER_COMPLETION_KEYS } from './completion';

describe('completionOf', () => {
  it('is 0 for an empty profile and 100 for a full one', () => {
    expect(completionOf({}, TRAVELER_COMPLETION_KEYS)).toBe(0);
    const full = { bio: 'b', photoUrl: 'https://x/y.png', country: 'SD', languages: ['ar'], interests: ['food'], travelStyles: ['slow'], budgetLevel: 3, preferredDestinations: ['Khartoum'] };
    expect(completionOf(full, TRAVELER_COMPLETION_KEYS)).toBe(100);
  });
  it('treats empty arrays, blank strings and null as unfilled', () => {
    expect(completionOf({ bio: '   ', languages: [], country: null, interests: undefined }, TRAVELER_COMPLETION_KEYS)).toBe(0);
  });
  it('rounds filled/total (8 traveler keys, 7 host keys)', () => {
    expect(completionOf({ bio: 'x' }, TRAVELER_COMPLETION_KEYS)).toBe(13);
    expect(completionOf({ bio: 'x', city: 'K' }, HOST_COMPLETION_KEYS)).toBe(29);
  });
  it('is computed from the merged record, so a partial update keeps earlier fields counted', () => {
    const stored = { bio: 'b', country: 'SD', languages: ['ar'], interests: ['food'] };
    const update = { bio: 'new bio' };
    expect(completionOf({ ...stored, ...update }, TRAVELER_COMPLETION_KEYS)).toBe(50);
    expect(completionOf(update, TRAVELER_COMPLETION_KEYS)).toBe(13); // what the old code stored
  });
});

describe('definedOnly', () => {
  it('drops undefined (declared-but-absent DTO fields) and keeps null and falsy values', () => {
    expect(definedOnly({ a: undefined, b: null, c: 0, d: '', e: [], f: 'x' })).toEqual({ b: null, c: 0, d: '', e: [], f: 'x' });
  });
  it('does not let an absent field overwrite a stored value when merged', () => {
    const stored = { bio: 'kept', country: 'SD' };
    const dto = { bio: undefined, country: 'EG' };
    expect({ ...stored, ...definedOnly(dto) }).toEqual({ bio: 'kept', country: 'EG' });
  });
});
