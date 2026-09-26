export const RESIDENT_TOKEN_KEY = 'minicityServerToken';

export function getResidentToken(): string | null {
  // Governance/voting reads can encounter restricted storage. Treat that read
  // as signed out rather than throwing from a render or retaining a stale token.
  try { return localStorage.getItem(RESIDENT_TOKEN_KEY); }
  catch { return null; }
}
