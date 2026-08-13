import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { AsyncGate } from './asyncGate.js';
import { SESSION_TTL_DAYS } from './config.js';
import { createUser, getUserByNickname, getUserByToken, updateUserToken } from './db.js';
import type { User } from './types.js';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const passwordWork = new AsyncGate(4, 32);
const derivePassword = (password: string, salt: Buffer, length = 64): Promise<Buffer> => passwordWork.run(() => new Promise((resolve, reject) => {
  scrypt(password, salt, length, (error, derived) => error ? reject(error) : resolve(derived));
}));
const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derived = await derivePassword(password, salt);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
};
const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const derived = await derivePassword(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
};
const sessionExpiry = () => new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();

export const NICKNAME_PATTERN = /^[\p{L}\p{N}]{2,40}$/u;
export function validateNickname(nickname: string): string | null {
  if (!nickname || nickname.length < 2) return 'Nickname must contain at least two characters';
  if (!NICKNAME_PATTERN.test(nickname)) return 'Nickname may only contain letters and numbers';
  return null;
}

export async function authenticate(input: { token?: string; nickname?: string; password?: string }): Promise<{ user: User; token: string; registered: boolean }> {
  if (input.token) {
    if (input.token.length > 128) throw new Error('Session is invalid');
    const user = getUserByToken(hash(input.token));
    if (user) return { user, token: input.token, registered: false };
    throw new Error('Session expired; sign in again');
  }

  const nickname = (input.nickname ?? '').normalize('NFKC').trim();
  const nicknameError = validateNickname(nickname);
  if (nicknameError) throw new Error(nicknameError);
  const password = input.password ?? '';
  if (!password) throw new Error('Password is required');
  if (password.length > 128) throw new Error('Password is too long');

  const existing = getUserByNickname(nickname);
  if (existing) {
    if (existing.disabled || !existing.passwordHash || !await verifyPassword(password, existing.passwordHash)) {
      throw new Error('Nickname or password is incorrect');
    }
    const newToken = randomBytes(32).toString('base64url');
    updateUserToken(existing.id, hash(newToken), sessionExpiry());
    return { user: getUserByToken(hash(newToken))!, token: newToken, registered: false };
  }
  if (password.length < 10) throw new Error('New passwords must contain at least 10 characters');

  const newToken = randomBytes(32).toString('base64url');
  const user = createUser(randomUUID(), hash(newToken), nickname, await hashPassword(password), sessionExpiry());
  return { user, token: newToken, registered: true };
}
