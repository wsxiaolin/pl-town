export const RESIDENT_TOKEN_KEY = 'minicityServerToken';

export function getResidentToken(): string | null {
  // Storage can be unavailable in a restricted browser context. Treat that as
  // signed out rather than throwing from a render or retaining a stale token.
  try { return localStorage.getItem(RESIDENT_TOKEN_KEY); }
  catch { return null; }
}
