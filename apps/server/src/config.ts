import { chmodSync, mkdirSync } from 'node:fs';
import { isIP } from 'node:net';
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

// Reverse proxies whose X-Forwarded-For header may be trusted. Entries are
// literal IP addresses or CIDR ranges (hostnames are rejected); IPv4-mapped
// IPv6 forms are normalised to plain IPv4. The loopback default keeps the
// bundled nginx deployment working while failing closed for every other peer.
const proxyAddresses = (raw: string | undefined, fallback: string): ReadonlyArray<string> => {
  const value = raw === undefined || raw.trim() === '' ? fallback : raw;
  const entries = value.split(',').map((item) => item.trim()).filter(Boolean)
    .map((item) => (item.toLowerCase().startsWith('::ffff:') ? item.slice(7) : item));
  if (entries.length === 0) throw new Error('TRUSTED_PROXIES must list at least one IP address or CIDR range');
  for (const entry of entries) {
    const separator = entry.lastIndexOf('/');
    const address = separator === -1 ? entry : entry.slice(0, separator);
    if (!isIP(address)) throw new Error(`TRUSTED_PROXIES contains a non-IP entry: ${entry}`);
    const prefix = separator === -1 ? undefined : entry.slice(separator + 1);
    const maximum = isIP(address) === 6 ? 128 : 32;
    if (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > maximum)) {
      throw new Error(`TRUSTED_PROXIES contains an invalid CIDR prefix length: ${entry}`);
    }
  }
  return entries;
};

const origins = (raw: string | undefined): { exact: ReadonlySet<string>; wildcardHosts: ReadonlySet<string> } => {
  const values = (raw ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const exact = new Set<string>();
  const wildcardHosts = new Set<string>();
  for (const value of values) {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('ALLOWED_ORIGINS only accepts HTTP(S) origins');
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('ALLOWED_ORIGINS entries must be origins without paths');
    if (url.hostname.startsWith('*.')) {
      if (url.hostname.length <= 2 || url.hostname.slice(2).includes('*')) throw new Error('ALLOWED_ORIGINS wildcard must use a single leading *');
      wildcardHosts.add(`${url.protocol}//${url.hostname.slice(2)}${url.port ? `:${url.port}` : ''}`.toLowerCase());
    } else exact.add(url.origin);
  }
  return { exact, wildcardHosts };
};

const httpUrl = (name: string, raw: string): string => {
  const value = new URL(raw);
  if (value.protocol !== 'http:' && value.protocol !== 'https:') throw new Error(`${name} must be an HTTP(S) URL`);
  if (value.username || value.password || value.hash) throw new Error(`${name} must not contain credentials or a fragment`);
  return value.toString();
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
// X-Forwarded-For is only read when the TCP peer matches one of these
// addresses/ranges; otherwise the header is ignored (see requestSecurity.ts).
export const TRUSTED_PROXIES = proxyAddresses(process.env.TRUSTED_PROXIES, '127.0.0.1,::1');
const allowedOrigins = origins(process.env.ALLOWED_ORIGINS);
export const ALLOWED_ORIGINS = allowedOrigins.exact;
export const ALLOWED_ORIGIN_WILDCARDS = allowedOrigins.wildcardHosts;
export const ALLOW_ORIGINLESS_WEBSOCKET = boolean('ALLOW_ORIGINLESS_WEBSOCKET', !IS_PRODUCTION);
// Physics Lab ("物实") OAuth account login. It reuses the shared public
// `community` OAuth client that ships with the Physics Lab service, so the town
// does not register a client of its own. The feature unlocks only when both the
// authorize page and the public town origin are configured.
export const PHYSICS_LAB_OAUTH_AUTHORIZE_URL = (() => {
  const raw = process.env.PHYSICS_LAB_OAUTH_AUTHORIZE_URL?.trim() ?? '';
  return raw ? httpUrl('PHYSICS_LAB_OAUTH_AUTHORIZE_URL', raw) : '';
})();
export const PHYSICS_LAB_OAUTH_PUBLIC_ORIGIN = (() => {
  const raw = process.env.PHYSICS_LAB_OAUTH_PUBLIC_ORIGIN?.trim() ?? '';
  if (!raw) return '';
  const value = new URL(raw);
  if (value.protocol !== 'http:' && value.protocol !== 'https:') throw new Error('PHYSICS_LAB_OAUTH_PUBLIC_ORIGIN must be an HTTP(S) origin');
  if (value.username || value.password || value.hash || value.search || value.pathname !== '/') throw new Error('PHYSICS_LAB_OAUTH_PUBLIC_ORIGIN must be an origin without a path');
  return value.origin;
})();
export const PHYSICS_LAB_OAUTH_CLIENT_ID = process.env.PHYSICS_LAB_OAUTH_CLIENT_ID?.trim() || 'community';
// The public community client secret is shared with every Physics Lab
// installation; it is not a per-deployment credential.
export const PHYSICS_LAB_OAUTH_CLIENT_SECRET = process.env.PHYSICS_LAB_OAUTH_CLIENT_SECRET?.trim() || 'a_secret_that_you_dont_know_dont_know_dont_know';
export const PHYSICS_LAB_OAUTH_ENABLED = PHYSICS_LAB_OAUTH_AUTHORIZE_URL !== '' && PHYSICS_LAB_OAUTH_PUBLIC_ORIGIN !== '';
// The Physics Lab service appends this fixed suffix to the redirect base it is
// given, so the callback lives under /town-api/ and already reaches the server.
export const PHYSICS_LAB_OAUTH_CALLBACK_PATH = '/town-api/auth/oauth2_basic/callback';
export const PHYSICS_LAB_OAUTH_STATE_TTL_MS = integer('PHYSICS_LAB_OAUTH_STATE_TTL_MS', 600_000, 60_000, 3_600_000);

export const MAX_CONNECTIONS = integer('MAX_CONNECTIONS', 500, 1, 10_000);
export const MAX_CONNECTIONS_PER_IP = integer('MAX_CONNECTIONS_PER_IP', 20, 1, 1_000);
export const SESSION_TTL_DAYS = integer('SESSION_TTL_DAYS', 30, 1, 365);

export const BIGMODEL_API_KEY = process.env.BIGMODEL_API_KEY?.trim() ?? '';
export const BIGMODEL_MODERATION_URL = httpUrl(
  'BIGMODEL_MODERATION_URL',
  process.env.BIGMODEL_MODERATION_URL ?? 'https://open.bigmodel.cn/api/paas/v4/moderations',
);
export const BIGMODEL_MODERATION_TIMEOUT_MS = integer('BIGMODEL_MODERATION_TIMEOUT_MS', 8_000, 1_000, 30_000);
export const BIGMODEL_MODERATION_CONCURRENCY = integer('BIGMODEL_MODERATION_CONCURRENCY', 4, 1, 32);

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

// Off-site (Alibaba Cloud OSS) backups. Console upload still only accepts a
// local verified backup. Ephemeral hosts can also restore the latest remote
// object on empty start, upload on SIGTERM, and accept a CI snapshot POST.
export const OSS_ENABLED = boolean('OSS_ENABLED', false);
export const OSS_REGION = process.env.OSS_REGION ?? '';
export const OSS_BUCKET = process.env.OSS_BUCKET ?? '';
export const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID ?? '';
export const OSS_ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET ?? '';
export const OSS_ENDPOINT = process.env.OSS_ENDPOINT ?? '';
export const OSS_PREFIX = process.env.OSS_PREFIX ?? 'minicity/backups/';
export const OSS_SECURE = boolean('OSS_SECURE', true);
export const OFFSITE_BACKUP_ENABLED = OSS_ENABLED && OSS_BUCKET !== '' && OSS_ACCESS_KEY_ID !== '' && OSS_ACCESS_KEY_SECRET !== '';
// Ephemeral hosts (Render free disk) lose SQLite on every deploy. Restore the
// latest OSS object when the local database has no residents, and upload a
// verified snapshot during SIGTERM so the next boot has something to pull.
export const OSS_RESTORE_ON_EMPTY_START = boolean('OSS_RESTORE_ON_EMPTY_START', false);
export const OSS_UPLOAD_ON_SHUTDOWN = boolean('OSS_UPLOAD_ON_SHUTDOWN', false);
export const DEPLOY_SNAPSHOT_TOKEN = process.env.DEPLOY_SNAPSHOT_TOKEN?.trim() ?? '';

if ((ADMIN_USERNAME && !ADMIN_PASSWORD) || (!ADMIN_USERNAME && ADMIN_PASSWORD)) {
  throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured together');
}
if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 16) throw new Error('ADMIN_PASSWORD must contain at least 16 characters');
if (new Set(ADMIN_ACCOUNTS.map((account) => account.username)).size !== ADMIN_ACCOUNTS.length) {
  throw new Error('Administrator usernames must be unique');
}
if (IS_PRODUCTION && !ADMIN_ENABLED) throw new Error('Production requires at least one administrator account');
if (IS_PRODUCTION && ALLOWED_ORIGINS.size + ALLOWED_ORIGIN_WILDCARDS.size === 0) throw new Error('Production requires at least one ALLOWED_ORIGINS entry');
if (IS_PRODUCTION && BIGMODEL_API_KEY && new URL(BIGMODEL_MODERATION_URL).protocol !== 'https:') throw new Error('Production requires an HTTPS BIGMODEL_MODERATION_URL');
if (OSS_ENABLED && !OFFSITE_BACKUP_ENABLED) throw new Error('OSS_ENABLED requires OSS_BUCKET, OSS_ACCESS_KEY_ID, and OSS_ACCESS_KEY_SECRET');
if (OSS_ENABLED && OSS_REGION === '' && OSS_ENDPOINT === '') throw new Error('OSS_ENABLED requires OSS_REGION or OSS_ENDPOINT');
if (OSS_ENABLED && OSS_PREFIX.startsWith('/')) throw new Error('OSS_PREFIX must not start with a slash');
if ((OSS_RESTORE_ON_EMPTY_START || OSS_UPLOAD_ON_SHUTDOWN) && !OFFSITE_BACKUP_ENABLED) {
  throw new Error('OSS_RESTORE_ON_EMPTY_START and OSS_UPLOAD_ON_SHUTDOWN require OSS to be configured');
}
if (DEPLOY_SNAPSHOT_TOKEN && DEPLOY_SNAPSHOT_TOKEN.length < 32) throw new Error('DEPLOY_SNAPSHOT_TOKEN must contain at least 32 characters');
if (DEPLOY_SNAPSHOT_TOKEN && !OFFSITE_BACKUP_ENABLED) throw new Error('DEPLOY_SNAPSHOT_TOKEN requires OSS to be configured');

for (const directory of [DATA_DIR, LOG_DIR, BACKUP_DIR]) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { chmodSync(directory, 0o700); } catch { /* Windows and managed volumes may not expose POSIX modes. */ }
}
