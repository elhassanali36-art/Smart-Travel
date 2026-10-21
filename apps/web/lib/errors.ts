import { ApiError } from './api';
import type { Dictionary } from './i18n';

// Maps an API failure to a localized message. Server messages are English and are not shown to Arabic users.
export function errorText(e: unknown, t: Dictionary['errors']): string {
  if (!(e instanceof ApiError)) return t.server;
  switch (e.status) {
    case 0: return t.network;
    case 400: return t.validation;
    case 401: return t.unauthorized;
    case 403: return t.forbidden;
    case 404: return t.notFound;
    case 409: return t.conflict;
    case 429: return t.tooMany;
    default: return t.server;
  }
}
// For forms: English users also see the specific server message when it is a validation problem.
export function detailedErrorText(e: unknown, t: Dictionary['errors'], locale: string): string {
  const base = errorText(e, t);
  return e instanceof ApiError && e.status === 400 && locale !== 'ar' && e.message ? `${base} (${e.message})` : base;
}
