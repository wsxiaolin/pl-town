import { MODERATION_API_URL, MODERATION_ENABLED, MODERATION_TIMEOUT_MS, ZHIPUAI_API_KEY } from './config.js';
import { logger } from './logger.js';

// Automatic text moderation backed by the ZhipuAI / BigModel content safety
// API (https://open.bigmodel.cn/api/paas/v4/moderations). The API key is read
// from the environment at startup; when it is missing or empty, moderation is
// disabled and chat messages are never sent to an external service.

export type ModerationResult = {
  riskLevel: 'PASS' | 'REVIEW' | 'BLOCK' | 'REJECT' | 'HIGH' | 'UNKNOWN';
  riskTypes: string[];
  description: string;
};

export const isModerationEnabled = (): boolean => MODERATION_ENABLED;

const BLOCKING_RISK_LEVELS = new Set(['BLOCK', 'REJECT', 'HIGH']);

// A message is considered non-compliant when the machine suggests blocking it.
// "REVIEW" only suggests manual review, so it flags the message for admins but
// keeps it visible until a human acts.
export const isModerationViolation = (result: ModerationResult): boolean =>
  BLOCKING_RISK_LEVELS.has(result.riskLevel);

const normalizeRiskLevel = (value: unknown): ModerationResult['riskLevel'] => {
  if (typeof value !== 'string') return 'UNKNOWN';
  const normalized = value.toUpperCase();
  if (normalized === 'PASS' || normalized === 'REVIEW' || normalized === 'BLOCK' || normalized === 'REJECT' || normalized === 'HIGH') return normalized;
  return 'UNKNOWN';
};

// The official response uses `result_list`; some mirrors return OpenAI-style
// `results` entries. Parse either, and treat missing/unknown output as PASS so
// the server fails open instead of censoring messages it cannot interpret.
const parseModerationResponse = (payload: unknown): ModerationResult => {
  const body = payload as { result_list?: unknown; results?: unknown };
  const list = Array.isArray(body?.result_list) ? body.result_list : Array.isArray(body?.results) ? body.results : [];
  const first = (list as Array<Record<string, unknown>>)[0] ?? {};
  const riskTypes = Array.isArray(first.risk_type) ? first.risk_type.map(String) : [];
  const description = typeof first.risk_description === 'string' ? first.risk_description : '';
  return { riskLevel: normalizeRiskLevel(first.risk_level), riskTypes, description };
};

const requestModeration = async (input: string): Promise<ModerationResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
  try {
    const response = await fetch(MODERATION_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ZHIPUAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'moderation', input }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Moderation API returned HTTP ${response.status}`);
    return parseModerationResponse(await response.json());
  } finally {
    clearTimeout(timer);
  }
};

// Bounded concurrency so a chat spike cannot open an unbounded number of
// upstream HTTP connections at once. Requests are served in FIFO order.
const MAX_CONCURRENT_REQUESTS = 4;
let activeRequests = 0;
const waiters: Array<() => void> = [];

const acquire = (): Promise<void> => {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
};

const release = (): void => {
  activeRequests -= 1;
  const next = waiters.shift();
  if (next) next();
};

export const moderateText = async (input: string): Promise<ModerationResult> => {
  await acquire();
  try {
    return await requestModeration(input);
  } catch (error) {
    logger.warn('Moderation request failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    release();
  }
};