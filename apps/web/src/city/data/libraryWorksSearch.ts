// Library works search: the town library queries the community projects
// archive served by NetLogo-Mobile/projects-ai-summary (s.pltown.online).
// This module holds the endpoint contract and pure helpers so the search
// URL building stays unit-testable without a live network.

export const LIBRARY_SEARCH_API_BASE = 'https://s.pltown.online';

// The search API has no offset paging (limit is capped at 50 server-side),
// so a single request per search keeps behaviour honest and simple.
export const LIBRARY_SEARCH_PAGE_SIZE = 24;

export interface LibraryWorkRecord {
  id: string;
  name: string;
  contentLength?: number;
  userID?: string;
  userName?: string;
  editorID?: string;
  editorName?: string;
  year?: number | string | null;
  summary?: string;
  primaryDiscipline?: string[];
  secondaryDiscipline?: string[];
  keyWords?: string[];
  readability?: number;
  source?: string;
}

export interface LibrarySearchParams {
  keywords: string;
}

export interface LibrarySearchResponse {
  generatedAt?: string;
  count: number;
  keywords?: string[];
  extraKeywords?: string[];
  aiExpanded?: boolean;
  records?: LibraryWorkRecord[];
}

export function buildLibrarySearchUrl(
  base: string,
  params: LibrarySearchParams,
  limit: number = LIBRARY_SEARCH_PAGE_SIZE,
): string {
  const query = new URLSearchParams();
  const keywords = params.keywords.trim();
  if (keywords) query.set('keywords', keywords);
  query.set('limit', String(limit));
  return `${base.replace(/\/+$/, '')}/api/search?${query.toString()}`;
}

// Deep link to the archive's own work page (seo.mjs), which carries the
// AI summary, keywords and the routes back into the Physics Lab.
export function libraryWorkArchiveUrl(base: string, id: string): string {
  const encoded = encodeURIComponent(String(id || '').trim().toLowerCase());
  return `${base.replace(/\/+$/, '')}/w/${encoded}`;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  return [];
}

export function libraryWorkMetaLine(record: LibraryWorkRecord): string {
  const parts: string[] = [];
  parts.push(String(record.userName || '').trim() || '匿名');
  const year = Number(record.year);
  if (Number.isFinite(year) && year > 0) parts.push(String(year));
  const source = String(record.source || '').trim();
  if (source) parts.push(source);
  const disciplines = [...asList(record.primaryDiscipline).slice(0, 1), ...asList(record.secondaryDiscipline).slice(0, 2)];
  if (disciplines.length) parts.push(disciplines.join(' / '));
  return parts.join(' · ');
}

export function libraryWorkTags(record: LibraryWorkRecord, max: number = 6): string[] {
  return asList(record.keyWords).slice(0, max);
}
