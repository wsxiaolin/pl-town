import { chmodSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const integer = (name: string, fallback: number, minimum: number, maximum: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
};

const boolean = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === '1' || raw.toLowerCase() === 'true') return true;
  if (raw === '0' || raw.toLowerCase() === 'false') return false;
  throw new Error(`${name} must be true, false, 1, or 0`);
};

const origins = (raw: string | undefined): ReadonlySet<string> => {
  const values = (raw ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return new Set(values.map((value) => {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('ALLOWED_ORIGINS only accepts HTTP(S) origins');
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('ALLOWED_ORIGINS entries must be origins without paths');
    return url.origin;
  }));
};

export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const PORT = integer('PORT', 8787, 1, 65_535);
export const HOST = process.env.HOST ?? '0.0.0.0';
export const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data');
export const LOG_DIR = resolve(process.env.LOG_DIR ?? join(DATA_DIR, 'logs'));
export const BACKUP_DIR = resolve(process.env.BACKUP_DIR ?? join(DATA_DIR, 'backups'));
export const DATABASE_PATH = resolve(DATA_DIR, 'minicity.sqlite');

export const TRUST_PROXY_HOPS = integer('TRUST_PROXY_HOPS', 0, 0, 10);
export const ALLOWED_ORIGINS = origins(process.env.ALLOWED_ORIGINS);
export const ALLOW_ORIGINLESS_WEBSOCKET = boolean('ALLOW_ORIGINLESS_WEBSOCKET', !IS_PRODUCTION);
export const MAX_CONNECTIONS = integer('MAX_CONNECTIONS', 500, 1, 10_000);
export const MAX_CONNECTIONS_PER_IP = integer('MAX_CONNECTIONS_PER_IP', 20, 1, 1_000);
export const SESSION_TTL_DAYS = integer('SESSION_TTL_DAYS', 30, 1, 365);

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? '';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const parseAdminAccounts = (raw: string | undefined): ReadonlyArray<{ username: string; password: string }> => {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('ADMIN_ACCOUNTS_JSON must be a JSON object mapping usernames to passwords'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ADMIN_ACCOUNTS_JSON must be a JSON object mapping usernames to passwords');
  }
  return Object.entries(parsed).map(([username, password]) => {
    if (!username || username.length > 128 || typeof password !== 'string') {
      throw new Error('ADMIN_ACCOUNTS_JSON contains an invalid administrator account');
    }
    if (password.length < 16) throw new Error(`Password for administrator ${username} must contain at least 16 characters`);
    return { username, password };
  });
};
const additionalAdminAccounts = parseAdminAccounts(process.env.ADMIN_ACCOUNTS_JSON);
export const ADMIN_ACCOUNTS = Object.freeze([
  ...(ADMIN_USERNAME && ADMIN_PASSWORD ? [{ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }] : []),
  ...additionalAdminAccounts,
]);
export const ADMIN_SESSION_TTL_MINUTES = integer('ADMIN_SESSION_TTL_MINUTES', 480, 15, 1_440);
export const ADMIN_ENABLED = ADMIN_ACCOUNTS.length > 0;

// Anti-abuse: cap how many new resident accounts a single IP may create.
export const MAX_REGISTRATIONS_PER_IP = integer('MAX_REGISTRATIONS_PER_IP', 5, 1, 1_000);
export const REGISTRATION_WINDOW_MINUTES = integer('REGISTRATION_WINDOW_MINUTES', 60, 1, 10_080);

export const AUTO_BACKUP_ENABLED = boolean('AUTO_BACKUP_ENABLED', true);
export const BACKUP_ON_START = boolean('BACKUP_ON_START', true);
export const BACKUP_INTERVAL_MINUTES = integer('BACKUP_INTERVAL_MINUTES', 1_440, 1, 43_200);
export const BACKUP_RETENTION_DAYS = integer('BACKUP_RETENTION_DAYS', 30, 1, 3_650);
export const BACKUP_MAX_FILES = integer('BACKUP_MAX_FILES', 30, 1, 1_000);

// Off-site (Alibaba Cloud OSS) backups, uploaded/downloaded manually from the
// admin console. The OSS store is a secondary copy: a remote object can only be
// created from a local verified backup, so every remote backup always has a
// local original ("remote is a subset of local").
export const OSS_ENABLED = boolean('OSS_ENABLED', false);
export const OSS_REGION = process.env.OSS_REGION ?? '';
export const OSS_BUCKET = process.env.OSS_BUCKET ?? '';
export const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID ?? '';
export const OSS_ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET ?? '';
export const OSS_ENDPOINT = process.env.OSS_ENDPOINT ?? '';
export const OSS_PREFIX = process.env.OSS_PREFIX ?? 'minicity/backups/';
export const OSS_SECURE = boolean('OSS_SECURE', true);
export const OFFSITE_BACKUP_ENABLED = OSS_ENABLED && OSS_BUCKET !== '' && OSS_ACCESS_KEY_ID !== '' && OSS_ACCESS_KEY_SECRET !== '';

if ((ADMIN_USERNAME && !ADMIN_PASSWORD) || (!ADMIN_USERNAME && ADMIN_PASSWORD)) {
  throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured together');
}
if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 16) throw new Error('ADMIN_PASSWORD must contain at least 16 characters');
if (new Set(ADMIN_ACCOUNTS.map((account) => account.username)).size !== ADMIN_ACCOUNTS.length) {
  throw new Error('Administrator usernames must be unique');
}
if (IS_PRODUCTION && !ADMIN_ENABLED) throw new Error('Production requires at least one administrator account');
if (IS_PRODUCTION && ALLOWED_ORIGINS.size === 0) throw new Error('Production requires at least one ALLOWED_ORIGINS entry');
if (OSS_ENABLED && !OFFSITE_BACKUP_ENABLED) throw new Error('OSS_ENABLED requires OSS_BUCKET, OSS_ACCESS_KEY_ID, and OSS_ACCESS_KEY_SECRET');
if (OSS_ENABLED && OSS_REGION === '' && OSS_ENDPOINT === '') throw new Error('OSS_ENABLED requires OSS_REGION or OSS_ENDPOINT');
if (OSS_ENABLED && OSS_PREFIX.startsWith('/')) throw new Error('OSS_PREFIX must not start with a slash');

for (const directory of [DATA_DIR, LOG_DIR, BACKUP_DIR]) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { chmodSync(directory, 0o700); } catch { /* Windows and managed volumes may not expose POSIX modes. */ }
}
