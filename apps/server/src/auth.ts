import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { createUser, getUserByNickname, getUserByToken, updateUserToken } from './db.js';
import type { User } from './types.js';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const hashPassword = (password: string): string => {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
};
const verifyPassword = (password: string, stored: string): boolean => {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
};
// 昵称：至少两个字（≥2 个字符），只允许中英文与数字，禁止空格及任何标点/特殊符号。
export const NICKNAME_PATTERN = /^[\p{L}\p{N}]{2,40}$/u;
export function validateNickname(nickname: string): string | null {
  if (!nickname || nickname.length < 2) return '昵称至少需要两个字';
  if (!NICKNAME_PATTERN.test(nickname)) return '昵称只能使用中文、英文和数字，不能包含空格或特殊字符';
  return null;
}

export function authenticate(input: { token?: string; nickname?: string; password?: string }): { user: User; token: string; registered: boolean } {
  if (input.token) {
    const user = getUserByToken(hash(input.token));
    if (user) return { user, token: input.token, registered: false };
    throw new Error('登录已过期，请重新登录');
  }
  const nickname = (input.nickname ?? '').trim();
  const nicknameError = validateNickname(nickname);
  if (nicknameError) throw new Error(nicknameError);
  const password = input.password ?? '';
  if (!password) throw new Error('请设置密码');
  if (password.length > 128) throw new Error('密码过长');

  const existing = getUserByNickname(nickname);
  if (existing) {
    if (!existing.passwordHash || !verifyPassword(password, existing.passwordHash)) throw new Error('昵称或密码错误');
    const newToken = randomBytes(32).toString('base64url');
    updateUserToken(existing.id, hash(newToken));
    return { user: getUserByToken(hash(newToken))!, token: newToken, registered: false };
  }
  const newToken = randomBytes(32).toString('base64url');
  const user = createUser(randomUUID(), hash(newToken), nickname, hashPassword(password));
  return { user, token: newToken, registered: true };
}