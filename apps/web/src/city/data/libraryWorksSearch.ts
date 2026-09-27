// Library works search: the town library queries the community projects
// archive served by NetLogo-Mobile/projects-ai-summary (s.pltown.online).
// This module holds the endpoint contract and pure helpers so the search
// URL building stays unit-testable without a live network.

export const LIBRARY_SEARCH_API_BASE = 'https://s.pltown.online';

// The search API has no offset paging (limit is capped at 50 server-side),
// so a single request per search keeps behaviour honest and simple.
export const LIBRARY_SEARCH_PAGE_SIZE = 24;

// The archive holds a handful of pre-2020 records (3 in total); they stay
// reachable via the unfiltered listing instead of a dedicated option.
export const LIBRARY_SEARCH_YEARS: readonly number[] = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

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
  author: string;
  year: number | null;
}

export interface LibrarySearchResponse {
  generatedAt?: string;
  count: number;
  keywords?: string[];
  extraKeywords?: string[];
  aiExpanded?: boolean;
  records?: LibraryWorkRecord[];
}

export interface LibraryArchiveMeta {
  totalRecords?: number;
  generatedAt?: string;
}

export interface LibraryHotTermsResponse {
  type?: string;
  terms?: { term: string; count: number }[];
}

export function buildLibrarySearchUrl(
  base: string,
  params: LibrarySearchParams,
  limit: number = LIBRARY_SEARCH_PAGE_SIZE,
): string {
  const query = new URLSearchParams();
  const keywords = params.keywords.trim();
  const author = params.author.trim();
  if (keywords) query.set('keywords', keywords);
  if (author) query.set('author', author);
  if (params.year !== null && Number.isFinite(params.year)) query.set('year', String(params.year));
  query.set('limit', String(limit));
  return `${base.replace(/\/+$/, '')}/api/search?${query.toString()}`;
}

export function libraryArchiveMetaUrl(base: string): string {
  return `${base.replace(/\/+$/, '')}/api/meta`;
}

export function libraryHotTermsUrl(base: string): string {
  // The stats endpoint returns a fixed TOP-50 listing; the caller slices it.
  return `${base.replace(/\/+$/, '')}/api/stats?type=terms`;
}

// Deep links, matching the archive's own work page (seo.mjs plUrls).
export function libraryWorkUrls(
  base: string,
  id: string,
): { archive: string; experiment: string; discussion: string } {
  const encoded = encodeURIComponent(String(id || '').trim().toLowerCase());
  const origin = base.replace(/\/+$/, '');
  return {
    archive: `${origin}/w/${encoded}`,
    experiment: `https://plweb.turtlesim.com/#/p/Experiment/${encoded}`,
    discussion: `https://plweb.turtlesim.com/#/p/Discussion/${encoded}`,
  };
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
