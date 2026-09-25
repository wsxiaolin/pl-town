import { townApiUrl } from '../core/townApi';
import { applyCityState, getCityConfig, loadCityGovernance, makeRequestId, type CityState } from './cityGovernanceClient';

export type CityVotes = { epoch: string; projectIds: string[] };
const pending = new Map<string, string>();

async function request(path: string, init: RequestInit): Promise<Response> {
  try { return await fetch(townApiUrl(path), init); }
  catch { throw new Error('网络连接中断，请稍后重试'); }
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('投票服务暂时不可用，请稍后重试'); }
}

function token(): string {
  const value = localStorage.getItem('minicityServerToken');
  if (value) return value;
  window.dispatchEvent(new CustomEvent('minicity:login-required'));
  throw new Error('请先登录后投票');
}

function votes(value: unknown): value is CityVotes {
  const result = value as Partial<CityVotes> | null;
  return Boolean(result && typeof result.epoch === 'string' && Array.isArray(result.projectIds)
    && result.projectIds.every((id) => typeof id === 'string'));
}

export async function loadCityVotes(signal?: AbortSignal): Promise<CityVotes> {
  const currentToken = token();
  const response = await request('/town-api/city/votes', {
    cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
    headers: { accept: 'application/json', authorization: `Bearer ${currentToken}` },
  });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('minicity:login-required'));
    throw new Error('登录状态已失效，请登录后重试投票');
  }
  const result = await readJson(response);
  if (currentToken !== localStorage.getItem('minicityServerToken')) throw new Error('登录状态已变更，请重新打开众议院');
  if (!response.ok || !votes(result)) throw new Error('暂时无法读取已投票记录，请重试');
  return result;
}

export async function voteCity(projectId: string): Promise<CityVotes> {
  const config = getCityConfig();
  if (!config) throw new Error('城市建设数据暂时不可用，请稍后重试');
  const currentToken = token();
  const key = JSON.stringify([currentToken, projectId, config.version]);
  const requestId = pending.get(key) ?? makeRequestId();
  pending.set(key, requestId);
  const response = await request('/town-api/city/vote', {
    method: 'POST', signal: AbortSignal.timeout(8_000),
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ token: currentToken, projectId, configVersion: config.version, requestId }),
  });
  if (response.status === 401) window.dispatchEvent(new CustomEvent('minicity:login-required'));
  const result = await readJson(response);
  const payload = result && typeof result === 'object' ? result as { state?: CityState; votes?: CityVotes; error?: string } : {};
  // A proxy error or unconfirmed response must not turn a retry into a new vote.
  if ((response.ok && votes(payload.votes) && payload.state)
    || ([400, 404, 409].includes(response.status) && typeof payload.error === 'string')) pending.delete(key);
  if (response.status === 409) await loadCityGovernance();
  if (currentToken !== localStorage.getItem('minicityServerToken')) throw new Error('登录状态已变更，请重新打开众议院');
  if (!response.ok) {
    if (payload.error === 'Project already built') throw new Error('该建筑已建成，无需继续投票');
    if (response.status === 401) throw new Error('请先登录后投票');
    if (response.status === 429) throw new Error('操作太频繁，请稍后再投票');
    throw new Error('投票未完成，请刷新后重试');
  }
  if (!votes(payload.votes) || !payload.state) throw new Error('投票结果暂时不可用，请重试');
  // A newer websocket revision may arrive before this HTTP response. Keep its
  // city state while still accepting this resident's confirmed vote receipt.
  applyCityState(payload.state);
  return payload.votes;
}

export function disposeCityVoting(): void { pending.clear(); }
