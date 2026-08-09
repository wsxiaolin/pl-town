const API_BASE = 'https://physics-api-cn.turtlesim.com';
const STATIC_BASE = 'https://physics-lab.oss-cn-hongkong.aliyuncs.com';
const API_VERSION = 2502;
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

export async function authenticateAccount(login: string, password: string) {
  const response = await fetch(`${API_BASE}/Users/Authenticate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ Login: login, Password: password, Version: API_VERSION, Device: { Identifier: '7db01528cf13e2199e141c402d79190e', Language: 'Chinese' } }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || data.Status !== 200 || !data.AuthCode) throw new Error(data.Message || 'Physics Lab login failed');
  return { token: data.Token || '', authCode: data.AuthCode, user: data.Data?.User || null };
}

export async function requestAccount(session: ApiSession, path: string, body: unknown) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-API-Token': session.token, 'x-API-AuthCode': session.authCode, 'x-API-Version': String(API_VERSION) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || data.Status !== 200) throw new Error(data.Message || 'Physics Lab request failed');
  return data;
}

function imageUrl(id: string, image = 0) {
  return `${STATIC_BASE}/experiments/images/${id.slice(0, 4)}/${id.slice(4, 6)}/${id.slice(6, 8)}/${id.slice(8, 24)}/${image}.jpg`;
}

async function authenticate() {
  if (session && session.expiresAt > Date.now()) return session;
  const response = await fetch(`${API_BASE}/Users/Authenticate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      Login: null, Password: null, Version: API_VERSION,
      Device: { Identifier: '7db01528cf13e2199e141c402d79190e', Language: 'Chinese' },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Physics Lab authentication failed (${response.status})`);
  const data = await response.json() as Record<string, any>;
  if (data.Status !== 200 || !data.AuthCode) throw new Error(`Physics Lab authentication failed: ${data.Message || 'unknown response'}`);
  session = { token: data.Token || '', authCode: data.AuthCode, expiresAt: Date.now() + 30 * 60 * 1000 };
  return session;
}

export async function getPublicWorks(scope: 'knowledge' | 'senate' | 'all' | 'discussion' | 'featured') {
  const cached = cache.get(scope);
  if (cached && cached.expiresAt > Date.now()) return { source: 'live' as const, cached: true, works: cached.works };
  const credentials = await authenticate();
  const response = await fetch(`${API_BASE}/Contents/QueryExperiments`, {
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
  const payload = await response.json() as Record<string, any>;
  if (payload.Status !== 200) throw new Error(`Physics Lab works request failed: ${payload.Message || 'unknown response'}`);
  const values = Array.isArray(payload.Data?.$values) ? payload.Data.$values : [];
  const works = values
    .filter((item: any) => scope !== 'senate' || VOLUNTEER_ROLES.has(item.User?.Verification))
    .map((item: any): PublicWork => ({
      id: String(item.ID), title: String(item.Subject || 'Untitled work'), category: String(item.Category || 'Experiment'),
      author: String(item.User?.Nickname || 'Anonymous'), authorId: String(item.User?.ID || ''),
      verification: item.User?.Verification || null,
      tags: Array.isArray(item.Tags) ? item.Tags.filter((tag: unknown) => typeof tag === 'string' && !String(tag).startsWith('Type-')).slice(0, 5) : [],
      imageUrl: imageUrl(String(item.ID), Number(item.Image) || 0), createdAt: Number(item.CreationDate) || 0,
      visits: Number(item.Visits) || 0, stars: Number(item.Stars) || 0, comments: Number(item.Comments) || 0, remixes: Number(item.Remixes) || 0,
    }));
  cache.set(scope, { expiresAt: Date.now() + CACHE_TTL, works });
  return { source: 'live' as const, cached: false, works };
}

const QUERY_KEYS = new Set(['Category','Languages','ExcludeLanguages','Tags','ExcludeTags','ModelTags','ModelID','ParentID','UserID','Special','From','Skip','Take','Days','Sort','ShowAnnouncement']);
export async function queryPublicWorks(input: unknown) {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const query: Record<string, unknown> = {};
  for (const key of QUERY_KEYS) if (key in raw) query[key] = raw[key];
  query.Category = query.Category === 'Discussion' ? 'Discussion' : 'Experiment';
  query.Skip = Number.isInteger(query.Skip) ? Math.max(0, Math.min(1000, query.Skip as number)) : 0;
  query.Take = Number.isInteger(query.Take) ? Math.max(1, Math.min(24, query.Take as number)) : 24;
  query.Days = Number.isInteger(query.Days) ? Math.max(0, Math.min(3650, query.Days as number)) : 0;
  query.Sort = query.Sort === 1 ? 1 : 0;
  const cacheKey = `query:${JSON.stringify(query)}`; const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { source:'live' as const, cached:true, works:cached.works };
  const credentials = await authenticate();
  const response = await fetch(`${API_BASE}/Contents/QueryExperiments`, { method:'POST', headers:{'content-type':'application/json','x-API-Token':credentials.token,'x-API-AuthCode':credentials.authCode,'x-API-Version':String(API_VERSION)}, body:JSON.stringify({Query:query}), signal:AbortSignal.timeout(15_000) });
  const payload = await response.json() as Record<string, any>;
  if (!response.ok || payload.Status !== 200) throw new Error(payload.Message || `Physics Lab works request failed (${response.status})`);
  const values = Array.isArray(payload.Data?.$values) ? payload.Data.$values : [];
  const works = values.map((item:any):PublicWork=>({ id:String(item.ID), title:String(item.Subject||'Untitled work'), category:String(item.Category||query.Category), author:String(item.User?.Nickname||'Anonymous'), authorId:String(item.User?.ID||''), verification:item.User?.Verification||null, tags:Array.isArray(item.Tags)?item.Tags.filter((tag:unknown)=>typeof tag==='string'&&!String(tag).startsWith('Type-')).slice(0,5):[], imageUrl:imageUrl(String(item.ID),Number(item.Image)||0), createdAt:Number(item.CreationDate)||0, visits:Number(item.Visits)||0, stars:Number(item.Stars)||0, comments:Number(item.Comments)||0, remixes:Number(item.Remixes)||0 }));
  cache.set(cacheKey,{expiresAt:Date.now()+CACHE_TTL,works}); return {source:'live' as const,cached:false,works};
}
