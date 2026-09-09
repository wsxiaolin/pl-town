import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { AsyncGate } from './asyncGate.js';
import { SESSION_TTL_DAYS } from './config.js';
import { createUser, getUserByNickname, getUserByToken, registerUserAtomic, updateUserToken } from './db.js';
import { authenticateAccount, findPhysicsLabUser } from './physicsLab.js';
import type { User } from './types.js';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
/** Public SHA-256 token digest used to look up game-resident sessions over HTTP. */
export const tokenHash = hash;
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

/** Thrown when a per-IP registration cap rejects a new account. */
export class RegistrationLimitError extends Error {
  constructor() {
    super('该 IP 的注册数量已达上限，请稍后再试');
    this.name = 'RegistrationLimitError';
  }
}

/**
 * Thrown when a newly signed nickname already belongs to a Physics Lab
 * community account and no proof of ownership was provided. Clients answer
 * this by collecting the claimant's Physics Lab credentials and retrying the
 * sign-in with `pl` credentials attached.
 */
export class PhysicsLabVerificationRequiredError extends Error {
  readonly code = 'pl-verification-required';
  constructor() {
    super('这个昵称已属于物实社区，请用对应的物实账号验证身份后再签下，或者换一个昵称');
    this.name = 'PhysicsLabVerificationRequiredError';
  }
}

export type PhysicsLabCredentials = { login: string; password: string };

export const NICKNAME_PATTERN = /^[\p{L}\p{N}]{2,40}$/u;
export function validateNickname(nickname: string): string | null {
  if (!nickname || nickname.length < 2) return '昵称至少需要两个字符';
  if (!NICKNAME_PATTERN.test(nickname)) return '昵称只能包含字母和数字';
  return null;
}

export async function authenticate(input: { token?: string; nickname?: string; password?: string; ip?: string; registrationLimit?: { sinceIso: string; max: number }; pl?: PhysicsLabCredentials; plVerifyGuard?: () => void }): Promise<{ user: User; token: string; registered: boolean }> {
  if (input.token) {
    if (input.token.length > 128) throw new Error('会话无效');
    const user = getUserByToken(hash(input.token));
    if (user) return { user, token: input.token, registered: false };
    throw new Error('会话已过期，请重新登录');
  }

  const nickname = (input.nickname ?? '').normalize('NFKC').trim();
  const nicknameError = validateNickname(nickname);
  if (nicknameError) throw new Error(nicknameError);
  const password = input.password ?? '';
  if (!password) throw new Error('请输入密码');
  if (password.length > 128) throw new Error('密码过长');

  const existing = getUserByNickname(nickname);
  if (existing) {
    if (existing.disabled || !existing.passwordHash || !await verifyPassword(password, existing.passwordHash)) {
      throw new Error('昵称或密码不正确');
    }
    const newToken = randomBytes(32).toString('base64url');
    updateUserToken(existing.id, hash(newToken), sessionExpiry());
    return { user: getUserByToken(hash(newToken))!, token: newToken, registered: false };
  }
  if (password.length < 10) throw new Error('新密码至少需要 10 个字符');

  // Nickname ownership: a name that already belongs to a Physics Lab account
  // can only be signed by that account's owner. Fail closed on lookup errors.
  let plUserId: string | null = null;
  const plLookup = await findPhysicsLabUser(nickname).catch(() => {
    throw new Error('暂时无法确认昵称在物实社区的状态，请稍后再试');
  });
  if (plLookup.exists) {
    const pl = input.pl?.login && input.pl?.password ? input.pl : undefined;
    if (!pl) throw new PhysicsLabVerificationRequiredError();
    input.plVerifyGuard?.();
    const plSession = await authenticateAccount(pl.login, pl.password).catch(() => {
      throw new Error('物实账号验证失败：账号或密码不正确');
    });
    const plNickname = String(plSession.user?.Nickname ?? '').trim();
    const plId = String(plSession.user?.ID ?? '').trim();
    if (!plNickname || plNickname.toLowerCase() !== nickname.toLowerCase()) {
      throw new Error('物实账号验证失败：登录的物实账号与该昵称不一致');
    }
    if (plLookup.userId && plId && plLookup.userId !== plId) {
      throw new Error('物实账号验证失败：请使用持有这个昵称的物实账号');
    }
    plUserId = plId || plLookup.userId;
  }

  const newToken = randomBytes(32).toString('base64url');
  const tokenHash = hash(newToken);
  const passwordHash = await hashPassword(password);
  const expiresAt = sessionExpiry();
  const userId = randomUUID();
  if (input.ip && input.registrationLimit) {
    const { sinceIso, max } = input.registrationLimit;
    const result = registerUserAtomic(userId, tokenHash, nickname, passwordHash, expiresAt, input.ip, sinceIso, max, plUserId);
    if (!result.allowed) throw new RegistrationLimitError();
  } else {
    createUser(userId, tokenHash, nickname, passwordHash, expiresAt, plUserId);
  }
  return { user: getUserByToken(tokenHash)!, token: newToken, registered: true };
}
