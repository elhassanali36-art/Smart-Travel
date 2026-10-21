// Deterministic, explainable host score in [0, 100]. No randomness, no AI, no I/O.
export const WEIGHTS = { base: 40, perSharedInterest: 15, perSharedLanguage: 10, destinationMatch: 20 } as const;

export interface TravelerSignals {
  interests?: string[] | null;
  languages?: string[] | null;
  preferredDestinations?: string[] | null;
}
export interface HostSignals {
  expertise?: string[] | null;
  languages?: string[] | null;
  city?: string | null;
}

const norm = (list?: string[] | null) => new Set((list ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean));
const shared = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length;

export function scoreHost(t: TravelerSignals | null | undefined, h: HostSignals) {
  const sharedInterests = shared(norm(t?.interests), norm(h.expertise));
  const sharedLanguages = shared(norm(t?.languages), norm(h.languages));
  const city = h.city?.trim().toLowerCase();
  const destinationPreference = Boolean(city) && norm(t?.preferredDestinations).has(city as string);

  const components = {
    base: WEIGHTS.base,
    interests: sharedInterests * WEIGHTS.perSharedInterest,
    languages: sharedLanguages * WEIGHTS.perSharedLanguage,
    destination: destinationPreference ? WEIGHTS.destinationMatch : 0,
  };
  const raw = components.base + components.interests + components.languages + components.destination;
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  return { score, explanation: { sharedInterests, sharedLanguages, destinationPreference, components } };
}
