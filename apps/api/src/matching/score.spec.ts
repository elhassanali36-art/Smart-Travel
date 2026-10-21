import { scoreHost, WEIGHTS } from './score';

const host = { expertise: ['culture', 'food', 'history'], languages: ['ar', 'en'], city: 'Khartoum' };

describe('scoreHost', () => {
  it('gives the base score to an empty or missing traveler profile (no NaN)', () => {
    for (const t of [undefined, null, {}, { interests: [], languages: [], preferredDestinations: [] }, { interests: null, languages: null, preferredDestinations: null }]) {
      const r = scoreHost(t, host);
      expect(r.score).toBe(WEIGHTS.base);
      expect(Number.isNaN(r.score)).toBe(false);
    }
  });
  it('handles a host with no data at all', () => {
    const r = scoreHost({ interests: ['food'] }, {});
    expect(r.score).toBe(40);
    expect(r.explanation.destinationPreference).toBe(false);
  });
  it('adds weighted points for partial matches and explains them', () => {
    const r = scoreHost({ interests: ['food'], languages: ['en', 'fr'] }, host);
    expect(r.score).toBe(40 + 15 + 10);
    expect(r.explanation).toMatchObject({ sharedInterests: 1, sharedLanguages: 1, destinationPreference: false });
    expect(r.explanation.components).toEqual({ base: 40, interests: 15, languages: 10, destination: 0 });
  });
  it('counts a destination preference once and ignores case and spaces', () => {
    const r = scoreHost({ preferredDestinations: [' khartoum '] }, host);
    expect(r.score).toBe(60);
    expect(r.explanation.destinationPreference).toBe(true);
  });
  it('caps a perfect match at 100', () => {
    const r = scoreHost({ interests: ['culture', 'food', 'history'], languages: ['ar', 'en'], preferredDestinations: ['Khartoum'] }, host);
    expect(r.score).toBe(100);
  });
  it('does not double-count duplicates or case variants', () => {
    const r = scoreHost({ interests: ['Food', 'food', 'FOOD'] }, host);
    expect(r.explanation.sharedInterests).toBe(1);
    expect(r.score).toBe(55);
  });
  it('returns no match for a different city and disjoint interests', () => {
    const r = scoreHost({ interests: ['skiing'], languages: ['ja'], preferredDestinations: ['Oslo'] }, host);
    expect(r.score).toBe(40);
  });
  it('is deterministic and always inside 0..100', () => {
    const words = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed; };
    const pick = () => words.filter(() => rnd() % 2 === 0);
    for (let i = 0; i < 200; i++) {
      const t = { interests: pick(), languages: pick(), preferredDestinations: pick() };
      const h = { expertise: pick(), languages: pick(), city: words[rnd() % words.length] };
      const a = scoreHost(t, h);
      expect(a).toEqual(scoreHost(t, h));
      expect(a.score >= 0 && a.score <= 100 && Number.isInteger(a.score)).toBe(true);
    }
  });
});
