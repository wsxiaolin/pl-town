export const RESIDENT_TOKEN_KEY = 'minicityServerToken';

export function getResidentToken(): string | null {
  return localStorage.getItem(RESIDENT_TOKEN_KEY);
}
