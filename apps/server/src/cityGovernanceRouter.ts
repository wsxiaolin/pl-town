import type { IncomingMessage, ServerResponse } from 'node:http';
import { tokenHash } from './auth.js';
import { getUserByToken } from './db.js';
import { cityConfigETag, cityConfigJson, getCityState, mutateCity } from './cityGovernance.js';
import { HttpBodyError, readJson } from './httpBody.js';
import { FixedWindowRateLimiter } from './rateLimit.js';
import { pathOf } from './requestSecurity.js';
import { logger } from './logger.js';

const mutationRate = new FixedWindowRateLimiter(20, 60_000);

export async function handleCityRequest(request: IncomingMessage, response: ServerResponse, headers: Record<string, string>, committed: (userId: string, result: ReturnType<typeof mutateCity>) => void): Promise<boolean> {
  const path = pathOf(request);
  if (!path.startsWith('/town-api/city/')) return false;
  const reply = (status: number, body: unknown) => { response.writeHead(status, headers); response.end(JSON.stringify(body)); };
  try {
    if (request.method === 'GET' && path === '/town-api/city/config') {
      const tags = request.headers['if-none-match']?.split(',').map((tag) => tag.trim().replace(/^W\//, '')) ?? [];
      const unchanged = tags.includes(cityConfigETag) || tags.includes('*');
      response.writeHead(unchanged ? 304 : 200, { ...headers, etag: cityConfigETag, 'cache-control': 'no-cache', 'access-control-expose-headers': 'ETag' });
      response.end(unchanged ? undefined : cityConfigJson);
    } else if (request.method === 'GET' && path === '/town-api/city/state') {
      reply(200, getCityState());
    } else if (request.method === 'POST' && ['/town-api/city/donate', '/town-api/city/decorate'].includes(path)) {
      const body = await readJson(request, 2048);
      if (typeof body.token !== 'string' || !body.token || body.token.length > 128) throw new HttpBodyError('Please sign in', 401);
      const user = getUserByToken(tokenHash(body.token));
      if (!user) throw new HttpBodyError('Please sign in', 401);
      const rate = mutationRate.consume(user.id);
      if (!rate.allowed) {
        response.setHeader('retry-after', String(rate.retryAfterSeconds));
        throw new HttpBodyError('Too many city mutations', 429);
      }
      const result = mutateCity(user, path.endsWith('/donate') ? 'donate' : 'decorate', body);
      try { committed(user.id, result); }
      catch (error) { logger.warn('City committed; notification failed', { requestId: result.requestId, error: String(error) }); }
      reply(200, result);
    } else reply(404, { error: 'Unknown city endpoint' });
  } catch (error) {
    if (!(error instanceof HttpBodyError)) throw error;
    reply(error.statusCode, { error: error.message });
  }
  return true;
}
