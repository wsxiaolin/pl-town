export type CityDecoration = { id: string; name: string; kind: 'oak' | 'pine' | 'cherry' | 'lamp' | 'bench' | 'flowers'; cost: number };
export type CityProject = {
  id: string; name: string; description: string; cost: number;
  kind: 'building' | 'road' | 'trees' | 'lights' | 'decoration';
  buildingId?: string;
  placements?: Array<{ kind: CityDecoration['kind']; x: number; z: number }>;
  road?: { x: number; z: number; width: number; depth: number };
};
export type CityConfig = {
  schemaVersion: number; version: string; projects: CityProject[];
  personalPlots: Array<{ id: string; name: string; x: number; z: number; options: string[] }>;
  decorations: CityDecoration[]; initialBuiltBuildingIds: string[];
};
export type CityState = {
  epoch: string; revision: number; configVersion: string;
  projects: Array<{ id: string; funded: number; built: boolean }>;
  decorations: Array<{ plotId: string; decorationId: string; ownerId: string; ownerNickname: string }>;
};
import { townApiUrl } from '../core/townApi';

export type CityGovernanceListener = (config: CityConfig | null, state: CityState | null) => void;

const CONFIG_CACHE_KEY = 'minicityCityConfig';
const ETAG_CACHE_KEY = 'minicityCityConfigEtag';
const listeners = new Set<CityGovernanceListener>();
const pendingRequestIds = new Map<string, string>();
let config: CityConfig | null = null;
let state: CityState | null = null;
let loadSequence = 0;
let activeLoad: Promise<void> | null = null;
let activeSignal: AbortSignal | undefined;

function cachedConfig(): CityConfig | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CONFIG_CACHE_KEY) ?? 'null') as CityConfig | null;
    return value?.version && Array.isArray(value.projects) ? value : null;
  } catch { return null; }
}

function notify() { listeners.forEach((listener) => listener(config, state)); }

function validState(value: unknown): value is CityState {
  const item = value as Partial<CityState> | null;
  return Boolean(item && typeof item.epoch === 'string' && Number.isSafeInteger(item.revision)
    && typeof item.configVersion === 'string' && Array.isArray(item.projects) && Array.isArray(item.decorations));
}

async function fetchJson(path: string, signal?: AbortSignal, init?: RequestInit): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(8_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  return fetch(townApiUrl(path), { ...init, signal: requestSignal, headers: { accept: 'application/json', ...(init?.headers ?? {}) } });
}

export function getCityConfig(): CityConfig | null { return config; }
export function getCityState(): CityState | null { return state; }

export function loadCityGovernance(signal?: AbortSignal): Promise<void> {
  if (activeLoad && !activeSignal?.aborted) return activeLoad;
  activeLoad = null;
  const sequence = ++loadSequence;
  activeSignal = signal;
  activeLoad = (async () => {
    try {
      let etag = '';
      try { etag = sessionStorage.getItem(ETAG_CACHE_KEY) ?? ''; } catch { /* storage is optional */ }
      const response = await fetchJson('/town-api/city/config', signal, etag ? { headers: { 'if-none-match': etag } } : undefined);
      let nextConfig: CityConfig | null = null;
      if (response.status === 304) nextConfig = cachedConfig();
      else if (response.ok) {
        nextConfig = await response.json() as CityConfig;
        try { sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(nextConfig)); sessionStorage.setItem(ETAG_CACHE_KEY, response.headers.get('etag') ?? ''); } catch { /* storage is optional */ }
      }
      if (!nextConfig?.version) throw new Error('City configuration unavailable');
      if (sequence !== loadSequence) return;
      config = nextConfig;
      const stateResponse = await fetchJson('/town-api/city/state', signal, { cache: 'no-store' });
      if (stateResponse.ok) {
        const nextState = await stateResponse.json() as unknown;
        state = validState(nextState) && nextState.configVersion === config.version ? nextState : null;
      } else state = null;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        config = config ?? cachedConfig();
        state = null;
      }
    } finally {
      if (sequence === loadSequence) { activeLoad = null; activeSignal = undefined; notify(); }
    }
  })();
  return activeLoad;
}

export function subscribeCityGovernance(listener: CityGovernanceListener): () => void {
  listeners.add(listener);
  listener(config, state);
  return () => listeners.delete(listener);
}

export function applyCityState(next: unknown): boolean {
  if (!validState(next)) return false;
  if (!config || next.configVersion !== config.version) { state = null; void loadCityGovernance(); notify(); return false; }
  if (state && next.epoch === state.epoch && next.revision < state.revision) return false;
  state = next;
  notify();
  return true;
}

export function isConstructionPending(buildingId: string): boolean {
  // Keep the regular city usable while the optional governance service is unavailable.
  if (!config || !state || state.configVersion !== config.version) return false;
  if (config.initialBuiltBuildingIds.includes(buildingId)) return false;
  const project = config.projects.find((item) => item.buildingId === buildingId);
  if (!project) return false;
  return !state.projects.some((item) => item.id === project.id && item.built);
}

export function disposeCityGovernance(): void {
  loadSequence += 1;
  activeLoad = null;
  activeSignal = undefined;
  config = null;
  state = null;
  pendingRequestIds.clear();
  listeners.clear();
}

async function mutate(path: string, body: Record<string, unknown>, explicitRequestId?: string): Promise<CityState> {
  if (!config) throw new Error('城市建设数据暂时不可用，请稍后重试。');
  const token = localStorage.getItem('minicityServerToken');
  if (!token) {
    window.dispatchEvent(new CustomEvent('minicity:login-required'));
    throw new Error('请先登录');
  }
  const operationKey = `${path}:${JSON.stringify(body)}`;
  const requestId = explicitRequestId ?? pendingRequestIds.get(operationKey) ?? makeRequestId();
  if (!explicitRequestId) pendingRequestIds.set(operationKey, requestId);
  let response: Response;
  let payload: { state?: CityState; error?: string };
  try {
    response = await fetchJson(path, undefined, { method: 'POST', body: JSON.stringify({ ...body, token, configVersion: config.version, requestId }), headers: { 'content-type': 'application/json' } });
    payload = await response.json() as typeof payload;
  } catch {
    // Keep the request ID: a lost response does not mean the server rolled back.
    throw new Error('网络连接异常，请重试；重复请求不会重复扣费。');
  }
  if (!explicitRequestId && pendingRequestIds.get(operationKey) === requestId) pendingRequestIds.delete(operationKey);
  if (response.status === 401) window.dispatchEvent(new CustomEvent('minicity:login-required'));
  if (response.status === 409) {
    await loadCityGovernance();
  }
  if (!response.ok || !validState(payload.state)) throw new Error(cityOperationError(payload.error));
  applyCityState(payload.state);
  return payload.state;
}

function cityOperationError(error?: string): string {
  const messages: Record<string, string> = {
    'Insufficient currency': '金币不足，无法完成建设或捐款。请获得更多金币后重试。',
    'Plot already occupied': '这块地已被建设，请选择其他空地。',
    'Project already built': '该项目已建成，请选择其他建设项目。',
    'City config changed; reload config': '建设配置已更新，请确认最新信息后重试。',
    'Amount must be a positive safe integer': '请输入大于 0 的整数捐款金额。',
    'Too many city mutations': '操作太频繁，请稍后重试。',
    'Please sign in': '请先登录后再参与城市建设。',
  };
  return error && messages[error] ? messages[error] : '建设请求失败，请稍后重试。';
}

function makeRequestId() { return `city-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
export function donateCity(projectId: string, amount: number, requestId?: string) { return mutate('/town-api/city/donate', { projectId, amount }, requestId); }
export function decorateCity(plotId: string, decorationId: string, requestId?: string) { return mutate('/town-api/city/decorate', { plotId, decorationId }, requestId); }
