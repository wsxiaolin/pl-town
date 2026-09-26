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
  personalAreas?: Array<{ id: string; name: string; plotIds: string[] }>;
  decorations: CityDecoration[]; initialBuiltBuildingIds: string[];
};
export type CityState = {
  epoch: string; revision: number; configVersion: string;
  projects: Array<{ id: string; funded: number; built: boolean; votes: number }>;
  decorations: Array<{ plotId: string; decorationId: string; ownerId: string; ownerNickname: string }>;
};
import { townApiUrl } from '../core/townApi';
import { getResidentToken } from '../core/residentToken';

// This module is the existing browser transport facade, including safe error
// adaptation. Pure gameplay rules do not depend on this HTTP/storage boundary.

export type CityGovernanceListener = (config: CityConfig | null, state: CityState | null) => void;
export type CityMutationResult = { state: CityState; replayed: boolean };

const CONFIG_CACHE_KEY = 'minicityCityConfig';
const ETAG_CACHE_KEY = 'minicityCityConfigEtag';
const listeners = new Set<CityGovernanceListener>();
type PendingOperation = { requestId: string; configVersion: string; body: Record<string, unknown> };
// Do not expire uncertain receipts: the server may already have charged them.
// Only a confirmed outcome or disposal of this client session releases an ID.
const pendingRequestIds = new Map<string, PendingOperation>();
let config: CityConfig | null = null;
let state: CityState | null = null;
const pendingBuildings = new Set<string>();
const trustedBuiltBuildings = new Set<string>();
let loadSequence = 0;
let activeLoad: Promise<void> | null = null;
let activeSignal: AbortSignal | undefined;

function cachedConfig(): CityConfig | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CONFIG_CACHE_KEY) ?? 'null') as CityConfig | null;
    return value?.version && Array.isArray(value.projects) ? value : null;
  } catch { return null; }
}

function notify() {
  if (config && state?.configVersion === config.version) {
    const builtProjects = new Set(state.projects.filter((project) => project.built).map((project) => project.id));
    const initialBuildings = new Set(config.initialBuiltBuildingIds);
    pendingBuildings.clear();
    trustedBuiltBuildings.clear();
    initialBuildings.forEach((id) => trustedBuiltBuildings.add(id));
    for (const project of config.projects) {
      if (!project.buildingId) continue;
      if (initialBuildings.has(project.buildingId) || builtProjects.has(project.id)) trustedBuiltBuildings.add(project.buildingId);
      else pendingBuildings.add(project.buildingId);
    }
  } else if (config) {
    // While the new snapshot is unavailable, keep known construction outcomes
    // and hide new project buildings until the server confirms completion.
    const initialBuildings = new Set(config.initialBuiltBuildingIds);
    for (const project of config.projects) {
      if (project.buildingId && !initialBuildings.has(project.buildingId) && !trustedBuiltBuildings.has(project.buildingId)) pendingBuildings.add(project.buildingId);
    }
  }
  listeners.forEach((listener) => listener(config, state));
}

export function validState(value: unknown): value is CityState {
  const item = value as Partial<CityState> | null;
  return Boolean(item && typeof item.epoch === 'string' && Number.isSafeInteger(item.revision)
    && typeof item.configVersion === 'string' && Array.isArray(item.projects)
    && item.projects.every((project) => project && typeof project.id === 'string'
      && Number.isSafeInteger(project.funded) && project.funded >= 0 && typeof project.built === 'boolean'
      && Number.isSafeInteger(project.votes) && project.votes >= 0)
    && Array.isArray(item.decorations));
}

function isOlderCityState(next: CityState): boolean {
  // A new configuration/epoch establishes a new sequence, even at revision zero.
  return Boolean(state && next.configVersion === state.configVersion
    && next.epoch === state.epoch && next.revision < state.revision);
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
    let stateBeforeFetch = state;
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
      if (state?.configVersion !== config.version) state = null;
      notify();
      stateBeforeFetch = state;
      const stateResponse = await fetchJson('/town-api/city/state', signal, { cache: 'no-store' });
      const nextState: unknown = stateResponse.ok ? await stateResponse.json() : null;
      if (sequence !== loadSequence) return;
      if (validState(nextState) && nextState.configVersion === config.version) {
        // A WS update can arrive while this HTTP snapshot is in flight.
        if (!isOlderCityState(nextState)) state = nextState;
      } else if (state === stateBeforeFetch) state = null;
    } catch (error) {
      if (sequence === loadSequence && (error as Error).name !== 'AbortError') {
        config = config ?? cachedConfig();
        if (state === stateBeforeFetch) state = null;
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
  if (isOlderCityState(next)) return false;
  state = next;
  notify();
  return true;
}

export function isConstructionPending(buildingId: string): boolean {
  // Before any configuration the optional service has no policy. Reloads keep
  // trusted outcomes and hide newly configured projects until a matching state
  // arrives, including when the state request fails.
  return pendingBuildings.has(buildingId);
}

export function disposeCityGovernance(): void {
  loadSequence += 1;
  activeLoad = null;
  activeSignal = undefined;
  config = null;
  state = null;
  pendingBuildings.clear();
  trustedBuiltBuildings.clear();
  pendingRequestIds.clear();
  listeners.clear();
}

async function mutate(path: string, body: Record<string, unknown>): Promise<CityMutationResult> {
  if (!config) throw new Error('城市建设数据暂时不可用，请稍后重试。');
  const token = getResidentToken();
  if (!token) {
    window.dispatchEvent(new CustomEvent('minicity:login-required'));
    throw new Error('请先登录');
  }
  const operationKey = `${path}:${body.areaId !== undefined
    ? JSON.stringify({ areaId: body.areaId, decorationId: body.decorationId })
    : JSON.stringify(body)}`;
  // The server fingerprint includes configVersion. Preserve the complete receipt
  // after an uncertain outcome, even if the current catalog changes before retry.
  const operation = pendingRequestIds.get(operationKey)
    ?? { requestId: makeRequestId(), configVersion: config.version, body: { ...body } };
  const { requestId, configVersion } = operation;
  pendingRequestIds.set(operationKey, operation);
  let response: Response;
  let payload: { state?: CityState; error?: string; replayed?: boolean };
  try {
    response = await fetchJson(path, undefined, { method: 'POST', body: JSON.stringify({ ...operation.body, token, configVersion, requestId }), headers: { 'content-type': 'application/json' } });
  } catch (error) {
    // Keep the request ID: a lost response does not mean the server rolled back.
    console.debug('[city-governance] request transport failed', error instanceof Error ? error.name : 'UnknownError');
    throw new Error('网络连接异常，请重试；重复请求不会重复扣费。');
  }
  try {
    const parsed: unknown = await response.json();
    payload = parsed && typeof parsed === 'object' ? parsed as typeof payload : {};
  } catch (error) {
    // A malformed response may still follow a committed operation, so retain the ID.
    console.debug('[city-governance] response JSON could not be parsed', error instanceof Error ? error.name : 'UnknownError');
    throw new Error('服务器响应格式异常，请重试；重复请求不会重复扣费。');
  }
  if (response.status === 401) window.dispatchEvent(new CustomEvent('minicity:login-required'));
  // Report the rejected operation immediately; a slow refresh must not hide it.
  if (response.status === 409) void loadCityGovernance();
  if (!response.ok || !validState(payload.state)) {
    if (isDefinitiveRejection(response, payload.error) && pendingRequestIds.get(operationKey) === operation) {
      pendingRequestIds.delete(operationKey);
    }
    throw new Error(cityOperationError(payload.error));
  }
  if (pendingRequestIds.get(operationKey) === operation) pendingRequestIds.delete(operationKey);
  applyCityState(payload.state);
  return { state: payload.state, replayed: payload.replayed === true };
}

// These keys are the city HttpBodyError contract. Keep them aligned with
// cityGovernance.ts and cityGovernanceRouter.ts; the integration suite checks it.
const cityOperationMessages: Record<string, string> = {
  'Unknown construction area': '建设区域不存在，请刷新后重试。',
  'No available plots in this area': '该区域已全部建设，请选择其他区域。',
  'Not enough available plots in this area': '该区域空地不足，请减少数量或选择其他区域。',
  'Quantity must be an integer between 1 and 100; choose one area': '请选择一个区域，并输入 1–100 之间的整数数量。',
  'Quantity requires an area': '请先选择批量建设区域。',
  'Invalid decoration total': '建设总价无效，请重新选择数量。',
  'Invalid requestId': '建设请求无效，请刷新页面后重试。',
  'Invalid configVersion': '建设配置无效，请刷新页面后重试。',
  'Invalid target': '建设目标无效，请重新选择项目或地块。',
  'Invalid decorationId': '装饰类型无效，请重新选择后重试。',
  'requestId already used with different parameters': '这次建设请求参数已变化，请重新提交当前内容。',
  'Decoration is not allowed on this plot': '这块地不支持当前装饰，请选择其他装饰。',
  'Unknown project': '建设项目不存在，请刷新页面后重试。',
  'Unknown plot or decoration': '地块或装饰不存在，请刷新页面后重试。',
  'Insufficient currency': '金币不足，无法完成建设或捐款。请获得更多金币后重试。',
  'Plot already occupied': '这块地已被建设，请选择其他空地。',
  'Project already built': '该项目已建成，请选择其他建设项目。',
  'City config changed; reload config': '建设配置已更新，请确认最新信息后重试。',
  'Amount must be a positive safe integer': '请输入大于 0 的整数捐款金额。',
  'Too many city mutations': '操作太频繁，请稍后重试。',
  'Please sign in': '请先登录后再参与城市建设。',
  'Unknown city endpoint': '城市建设服务暂时不可用，请稍后重试。',
};

function isDefinitiveRejection(response: Response, error?: string): boolean {
  // Authentication and rate checks run before receipt lookup. A 401/429 says
  // nothing about whether an earlier attempt committed, so keep its receipt.
  return [400, 404, 409].includes(response.status) && typeof error === 'string'
    && Object.hasOwn(cityOperationMessages, error);
}

function cityOperationError(error?: string): string {
  return typeof error === 'string' && Object.hasOwn(cityOperationMessages, error)
    ? cityOperationMessages[error]! : '建设请求失败，请稍后重试。';
}

export function makeRequestId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `city-${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}
export function donateCity(projectId: string, amount: number) { return mutate('/town-api/city/donate', { projectId, amount }); }
export function decorateCity(plotId: string, decorationId: string) { return mutate('/town-api/city/decorate', { plotId, decorationId }); }
export function decorateCityArea(areaId: string, decorationId: string, quantity: number) { return mutate('/town-api/city/decorate', { areaId, decorationId, quantity }); }
export function getPendingCityAreaOperation(areaId: string): { decorationId: string; quantity: number } | null {
  for (const operation of pendingRequestIds.values()) {
    if (operation.body.areaId === areaId && typeof operation.body.decorationId === 'string' && typeof operation.body.quantity === 'number') {
      return { decorationId: operation.body.decorationId, quantity: operation.body.quantity };
    }
  }
  return null;
}
