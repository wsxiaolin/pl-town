import { townApiUrl } from '../core/townApi';
import { getResidentToken } from '../core/residentToken';
import { applyCityState, getCityConfig, getCityState, loadCityGovernance, makeRequestId, validState, type CityState } from './cityGovernanceClient';

type VoteRecords = { epoch: string; projectIds: string[] };
export type CityVotes = VoteRecords & { sessionId: number };
export type CityVotesRead = { available: true; votes: CityVotes } | { available: false; sessionId: number };
const pending = new Map<string, string>();
let sessionToken: string | null = null;
let sessionId = 0;

// Session identity stays inside the client; UI snapshots and receipt keys use
// only an opaque generation and never retain the authentication credential.
export function getCityVotingSessionId(): number | null {
  const current = getResidentToken();
  if (current !== sessionToken) {
    sessionToken = current;
    sessionId += 1;
    pending.clear();
  }
  return current ? sessionId : null;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  try { return await fetch(townApiUrl(path), init); }
  catch {
    if (init.signal?.aborted && init.signal.reason?.name === 'TimeoutError') throw new Error('投票服务响应超时，请稍后重试');
    throw new Error('网络连接中断，请稍后重试');
  }
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('投票服务暂时不可用，请稍后重试'); }
}

function session(): { token: string; id: number } {
  const id = getCityVotingSessionId();
  if (id !== null && sessionToken) return { token: sessionToken, id };
  window.dispatchEvent(new CustomEvent('minicity:login-required'));
  throw new Error('请先登录后投票');
}

function votes(value: unknown): value is VoteRecords {
  const result = value as Partial<VoteRecords> | null;
  return Boolean(result && typeof result.epoch === 'string' && Array.isArray(result.projectIds)
    && result.projectIds.every((id) => typeof id === 'string'));
}

// Voting has its own rejection/receipt contract; only share the familiar
// presentation wording, not the construction-payment acknowledgement rules.
const voteOperationMessages: Record<string, string> = {
  'Project already built': '该建筑已建成，无需继续投票',
  'Unknown project': '投票项目不存在，请刷新建设列表后重试',
  'City config changed; reload config': '建设配置已更新，请确认最新信息后重试投票',
};

// Null denotes a cancelled read or a result belonging to an earlier resident.
export async function loadCityVotes(signal?: AbortSignal): Promise<CityVotesRead | null> {
  const owner = session();
  const isCurrent = () => !signal?.aborted && owner.id === getCityVotingSessionId();
  try {
    // GET has no JSON body; Bearer authentication keeps the token out of URLs.
    // POST below follows the existing construction mutation body's token field.
    const response = await request('/town-api/city/votes', {
      cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
      headers: { accept: 'application/json', authorization: `Bearer ${owner.token}` },
    });
    if (!isCurrent()) return null;
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('minicity:login-required'));
      throw new Error('登录状态已失效，请登录后重试投票');
    }
    // The frontend can reach an older independently deployed server. Only this
    // read endpoint establishes capability; a missing POST project is an error.
    if (response.status === 404 || response.status === 405) return { available: false, sessionId: owner.id };
    const result = await readJson(response);
    if (!isCurrent()) return null;
    if (!response.ok || !votes(result)) throw new Error('暂时无法读取已投票记录，请重试');
    return { available: true, votes: { ...result, sessionId: owner.id } };
  } catch (error) {
    if (!isCurrent()) return null;
    throw error;
  }
}

// Obsolete session results must not trigger login or update the current panel.
export async function voteCity(projectId: string): Promise<CityVotes | null> {
  const config = getCityConfig();
  if (!config) throw new Error('城市建设数据暂时不可用，请稍后重试');
  const requestedEpoch = getCityState()?.epoch;
  const owner = session();
  const key = JSON.stringify([owner.id, projectId, config.version]);
  const requestId = pending.get(key) ?? makeRequestId();
  pending.set(key, requestId);
  const isCurrent = () => owner.id === getCityVotingSessionId();
  try {
    const response = await request('/town-api/city/vote', {
      method: 'POST', signal: AbortSignal.timeout(8_000),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ token: owner.token, projectId, configVersion: config.version, requestId }),
    });
    if (!isCurrent()) return null;
    if (response.status === 401) window.dispatchEvent(new CustomEvent('minicity:login-required'));
    const result = await readJson(response);
    if (!isCurrent()) return null;
    const payload = result && typeof result === 'object' ? result as { state?: CityState; votes?: CityVotes; error?: string } : {};
    // A proxy error or unconfirmed response must not turn a retry into a new vote.
    if ((response.ok && votes(payload.votes) && validState(payload.state))
      || ([400, 404, 409].includes(response.status) && typeof payload.error === 'string')) pending.delete(key);
    if (response.status === 409) await loadCityGovernance();
    if (!isCurrent()) return null;
    if (!response.ok) {
      if (response.status === 401) throw new Error('请先登录后投票');
      if (response.status === 429) throw new Error('操作太频繁，请稍后再投票');
      if (typeof payload.error === 'string' && Object.hasOwn(voteOperationMessages, payload.error)) {
        throw new Error(voteOperationMessages[payload.error]);
      }
      throw new Error('投票未完成，请刷新后重试');
    }
    if (!votes(payload.votes) || !validState(payload.state)) throw new Error('投票结果暂时不可用，请重试');
    // A conflict can reload public state after a restore, before reconnecting
    // removes the revoked token. Do not publish that older, confirmed receipt.
    const currentEpoch = getCityState()?.epoch;
    if (requestedEpoch && currentEpoch && currentEpoch !== requestedEpoch
      && payload.state.epoch !== currentEpoch) return null;
    // A newer websocket revision may arrive before this HTTP response. Keep its
    // city state while still accepting this resident's confirmed vote receipt.
    applyCityState(payload.state);
    return { ...payload.votes, sessionId: owner.id };
  } catch (error) {
    // An old transport/JSON failure belongs to its original resident as well.
    if (!isCurrent()) return null;
    throw error;
  }
}

export function disposeCityVoting(): void { pending.clear(); sessionToken = null; sessionId += 1; }
