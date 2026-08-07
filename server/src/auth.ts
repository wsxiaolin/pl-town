import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createUser, getUserByToken } from './db.js';
import type { User } from './types.js';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export function authenticate(token?: string, nickname = '居民'): { user: User; token: string } {
  if (token) { const user = getUserByToken(hash(token)); if (user) return { user, token }; }
  const newToken = randomBytes(32).toString('base64url');
  return { user: createUser(randomUUID(), hash(newToken), nickname.trim().slice(0, 40) || '居民'), token: newToken };
}
