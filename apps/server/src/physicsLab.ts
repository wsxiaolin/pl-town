const API_BASE = 'https://physics-api-cn.turtlesim.com';
const STATIC_BASE = 'https://physics-lab.oss-cn-hongkong.aliyuncs.com';
const API_VERSION = 2502;
// The account endpoint still expects the legacy client schema version. Other
// authenticated endpoints use the current API version above.
const ACCOUNT_LOGIN_VERSION = 2411;
const CACHE_TTL = 5 * 60 * 1000;
const VOLUNTEER_ROLES = new Set(['Volunteer', 'Junior', 'Emeritus', 'Editor', 'Administrator']);

type ApiSession = { token: string; authCode: string; expiresAt: number };
type PublicWork = {
  id: string; title: string; category: string; author: string; authorId: string;
  verification: string | null; tags: string[]; imageUrl: string; createdAt: number;
  visits: number; stars: number; comments: number; remixes: number;
};

let session: ApiSession | null = null;
const cache = new Map<string, { expiresAt: number; works: PublicWork[] }>();
const MAX_CACHE_ENTRIES = 200;
const MAX_QUERY_LIST_ITEMS = 32;
const MAX_UPSTREAM_CONCURRENCY = 8;
let activeUpstreamRequests = 0;
const fetchUpstream = async (input: string, init: RequestInit): Promise<Response> => {
  if (activeUpstreamRequests >= MAX_UPSTREAM_CONCURRENCY) throw new Error('Physics Lab is busy; try again shortly');
  activeUpstreamRequests += 1;
  try { return await fetch(input, init); }
  finally { activeUpstreamRequests -= 1; }
};
const safeString = (value: unknown, maximum: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length <= maximum ? normalized : null;
};
const safeStringList = (value: unknown): string[] | null => {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length > MAX_QUERY_LIST_ITEMS) return null;
  const result = value.map((item) => safeString(item, 80));
  return result.every((item): item is string => item !== null) ? [...new Set(result)].sort() : null;
};
const cacheWorks = (key: string, works: PublicWork[]) => {
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(key)) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL, works });
};

export async function authenticateAccount(login: string, password: string) {
  const response = await fetchUpstream(`${API_BASE}/Users/Authenticate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ Login: login, Password: password, Version: ACCOUNT_LOGIN_VERSION, Device: { Identifier: '7db01528cf13e2199e141c402d79190e', Language: 'Chinese' } }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.Status !== 200 || !data.AuthCode) {
    const message = typeof data.Message === 'string' ? data.Message : '';
    if (message === 'Login.Password.Invalid') throw new Error('密码不正确，请检查登录方式和密码');
    if (message === 'Login.Invalid') throw new Error('登录名或密码不正确');
    if (message === 'Login.Expired') throw new Error('登录请求已过期，请稍后重试');
    throw new Error(message || 'Physics Lab 登录失败');
  }
  return { token: typeof data.Token === 'string' ? data.Token : '', authCode: data.AuthCode as string, user: (data.Data as { User?: { ID?: unknown; Nickname?: unknown } } | undefined)?.User ?? null };
}

export async function requestAccount(session: ApiSession, path: string, body: unknown) {
  const response = await fetchUpstream(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-API-Token': session.token, 'x-API-AuthCode': session.authCode, 'x-API-Version': String(API_VERSION) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.Status !== 200) throw new Error(typeof data.Message === 'string' ? data.Message : 'Physics Lab request failed');
  return data as Record<string, unknown>;
}

function imageUrl(id: string, image = 0) {
  return `${STATIC_BASE}/experiments/images/${id.slice(0, 4)}/${id.slice(4, 6)}/${id.slice(6, 8)}/${id.slice(8, 24)}/${image}.jpg`;
}

async function authenticate() {
  if (session && session.expiresAt > Date.now()) return session;
  const response = await fetchUpstream(`${API_BASE}/Users/Authenticate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      Login: null, Password: null, Version: API_VERSION,
      Device: { Identifier: '7db01528cf13e2199e141c402d79190e', Language: 'Chinese' },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Physics Lab authentication failed (${response.status})`);
  const data = await response.json() as Record<string, unknown>;
  if (data.Status !== 200 || !data.AuthCode) throw new Error(`Physics Lab authentication failed: ${typeof data.Message === 'string' ? data.Message : 'unknown response'}`);
  session = { token: typeof data.Token === 'string' ? data.Token : '', authCode: data.AuthCode as string, expiresAt: Date.now() + 30 * 60 * 1000 };
  return session;
}

export async function getPublicWorks(scope: 'knowledge' | 'senate' | 'all' | 'discussion' | 'featured') {
  const cached = cache.get(scope);
  if (cached && cached.expiresAt > Date.now()) return { source: 'live' as const, cached: true, works: cached.works };
  const credentials = await authenticate();
  const response = await fetchUpstream(`${API_BASE}/Contents/QueryExperiments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-API-Token': credentials.token,
      'x-API-AuthCode': credentials.authCode,
      'x-API-Version': String(API_VERSION),
    },
    body: JSON.stringify({ Query: {
      Category: scope === 'discussion' ? 'Discussion' : 'Experiment', Languages: [], ExcludeLanguages: null,
      Tags: scope === 'knowledge' ? ['知识库'] : scope === 'featured' ? ['精选'] : null, ExcludeTags: null,
      ModelTags: null, ModelID: null, ParentID: null, UserID: null, Special: null,
      From: null, Skip: 0, Take: 24, Days: 0, Sort: 0, ShowAnnouncement: false,
    } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Physics Lab works request failed (${response.status})`);
  const payload = await response.json() as Record<string, unknown>;
  if (payload.Status !== 200) throw new Error(`Physics Lab works request failed: ${typeof payload.Message === 'string' ? payload.Message : 'unknown response'}`);
  const values = Array.isArray((payload.Data as { $values?: unknown[] } | undefined)?.$values) ? (payload.Data as { $values: unknown[] }).$values : [];
  const works = values
    .filter((item: unknown) => scope !== 'senate' || VOLUNTEER_ROLES.has(((item as { User?: { Verification?: string } }).User ?? {}).Verification ?? ''))
    .map((item: unknown): PublicWork => {
      const record = item as { ID?: unknown; Subject?: unknown; Category?: unknown; User?: { Nickname?: unknown; ID?: unknown; Verification?: string | null }; Tags?: unknown; Image?: unknown; CreationDate?: unknown; Visits?: unknown; Stars?: unknown; Comments?: unknown; Remixes?: unknown };
      return {
      id: String(record.ID), title: String(record.Subject || 'Untitled work'), category: String(record.Category || 'Experiment'),
      author: String(record.User?.Nickname || 'Anonymous'), authorId: String(record.User?.ID || ''),
      verification: record.User?.Verification || null,
      tags: Array.isArray(record.Tags) ? record.Tags.filter((tag: unknown) => typeof tag === 'string' && !String(tag).startsWith('Type-')).slice(0, 5) : [],
      imageUrl: imageUrl(String(record.ID), Number(record.Image) || 0), createdAt: Number(record.CreationDate) || 0,
      visits: Number(record.Visits) || 0, stars: Number(record.Stars) || 0, comments: Number(record.Comments) || 0, remixes: Number(record.Remixes) || 0,
      };
    });
  cacheWorks(scope, works);
  return { source: 'live' as const, cached: false, works };
}

const QUERY_KEYS = new Set(['Category','Languages','ExcludeLanguages','Tags','ExcludeTags','ModelTags','ModelID','ParentID','UserID','Special','From','Skip','Take','Days','Sort','ShowAnnouncement']);
export async function queryPublicWorks(input: unknown) {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const query: Record<string, unknown> = {};
  for (const key of QUERY_KEYS) if (key in raw) query[key] = raw[key];
  query.Category = query.Category === 'Discussion' ? 'Discussion' : 'Experiment';
  for (const key of ['Languages', 'ExcludeLanguages', 'Tags', 'ExcludeTags', 'ModelTags']) query[key] = safeStringList(query[key]);
  for (const key of ['ModelID', 'ParentID', 'UserID', 'Special', 'From']) query[key] = safeString(query[key], 100);
  query.Skip = Number.isInteger(query.Skip) ? Math.max(0, Math.min(1000, query.Skip as number)) : 0;
  query.Take = Number.isInteger(query.Take) ? Math.max(1, Math.min(24, query.Take as number)) : 24;
  query.Days = Number.isInteger(query.Days) ? Math.max(0, Math.min(3650, query.Days as number)) : 0;
  query.Sort = query.Sort === 1 ? 1 : 0;
  query.ShowAnnouncement = query.ShowAnnouncement === true;
  const cacheKey = `query:${JSON.stringify(query)}`; const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { source:'live' as const, cached:true, works:cached.works };
  const credentials = await authenticate();
  const response = await fetchUpstream(`${API_BASE}/Contents/QueryExperiments`, { method:'POST', headers:{'content-type':'application/json','x-API-Token':credentials.token,'x-API-AuthCode':credentials.authCode,'x-API-Version':String(API_VERSION)}, body:JSON.stringify({Query:query}), signal:AbortSignal.timeout(15_000) });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok || payload.Status !== 200) throw new Error(typeof payload.Message === 'string' ? payload.Message : `Physics Lab works request failed (${response.status})`);
  const values = Array.isArray((payload.Data as { $values?: unknown[] } | undefined)?.$values) ? (payload.Data as { $values: unknown[] }).$values : [];
  const works = values.map((item: unknown): PublicWork => {
    const record = item as { ID?: unknown; Subject?: unknown; Category?: unknown; User?: { Nickname?: unknown; ID?: unknown; Verification?: string | null }; Tags?: unknown; Image?: unknown; CreationDate?: unknown; Visits?: unknown; Stars?: unknown; Comments?: unknown; Remixes?: unknown };
    return { id:String(record.ID), title:String(record.Subject||'Untitled work'), category:String(record.Category||(query.Category as string)), author:String(record.User?.Nickname||'Anonymous'), authorId:String(record.User?.ID||''), verification:record.User?.Verification||null, tags:Array.isArray(record.Tags)?record.Tags.filter((tag:unknown)=>typeof tag==='string'&&!String(tag).startsWith('Type-')).slice(0,5):[], imageUrl:imageUrl(String(record.ID),Number(record.Image)||0), createdAt:Number(record.CreationDate)||0, visits:Number(record.Visits)||0, stars:Number(record.Stars)||0, comments:Number(record.Comments)||0, remixes:Number(record.Remixes)||0 };
  });
  cacheWorks(cacheKey,works); return {source:'live' as const,cached:false,works};
}
