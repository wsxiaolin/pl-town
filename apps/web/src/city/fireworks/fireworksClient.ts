// 烟花玩法浏览器侧传输适配：把 fireworks.* WS 消息封装成 Promise API。
// 服务端契约见 apps/server/src/fireworksService.ts；fireworks.saved/deleted
// 用 requestId / designId 关联挂起的请求。
import type { FireworkDesign } from './fireworksDesign';

export type FireworkRecordView = {
  id: string;
  name: string;
  design: FireworkDesign;
  authorId: string;
  authorNickname: string;
  createdAt: string;
  updatedAt: string;
};

export type FireworksLibrary = {
  own: FireworkRecordView[];
  community: FireworkRecordView[];
  revision: string;
};

export type FireworksServerMessage =
  | { type: 'fireworks.listed'; own?: FireworkRecordView[]; community?: FireworkRecordView[]; revision?: string }
  | { type: 'fireworks.saved'; requestId?: string; record?: FireworkRecordView; replayed?: boolean; pricePaid?: number }
  | { type: 'fireworks.deleted'; designId?: string }
  | { type: 'fireworks.library'; revision?: string };

export type FireworksClientMessage =
  | { type: 'fireworks.list' }
  | { type: 'fireworks.save'; requestId: string; designId?: string; name: string; design: FireworkDesign }
  | { type: 'fireworks.delete'; designId: string };

export function createFireworksClient(options: {
  send: (message: FireworksClientMessage) => boolean;
}) {
  let pendingList: { resolve: (library: FireworksLibrary) => void; reject: (error: Error) => void; timer: number } | null = null;
  const pendingSaves = new Map<string, { resolve: (record: FireworkRecordView) => void; reject: (error: Error) => void; timer: number }>();
  const pendingDeletes = new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: number }>();
  const libraryListeners = new Set<(revision: string) => void>();
  let requestSequence = 0;

  const TIMEOUT_MS = 8_000;

  function failPending(reject: (error: Error) => void, message: string): void {
    reject(new Error(message));
  }

  function armTimeout(reject: (error: Error) => void): number {
    return window.setTimeout(() => failPending(reject, '烟花服务没有响应，请稍后再试'), TIMEOUT_MS);
  }

  function requestId(): string {
    requestSequence += 1;
    return `fw-${Date.now().toString(36)}-${requestSequence}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** 收到服务端 fireworks.* 消息时由组合根转发进来。 */
  function handleServerMessage(message: FireworksServerMessage): void {
    if (message.type === 'fireworks.listed') {
      if (!pendingList) return;
      window.clearTimeout(pendingList.timer);
      const resolve = pendingList.resolve;
      pendingList = null;
      resolve({ own: message.own ?? [], community: message.community ?? [], revision: message.revision ?? '' });
      return;
    }
    if (message.type === 'fireworks.saved') {
      const pending = message.requestId ? pendingSaves.get(message.requestId) : undefined;
      if (!pending) return;
      if (message.requestId) pendingSaves.delete(message.requestId);
      window.clearTimeout(pending.timer);
      pending.resolve(message.record!);
      return;
    }
    if (message.type === 'fireworks.deleted') {
      const pending = message.designId ? pendingDeletes.get(message.designId) : undefined;
      if (!pending) return;
      if (message.designId) pendingDeletes.delete(message.designId);
      window.clearTimeout(pending.timer);
      pending.resolve();
      return;
    }
    if (message.type === 'fireworks.library') {
      libraryListeners.forEach((listener) => listener(message.revision ?? ''));
    }
  }

  function list(): Promise<FireworksLibrary> {
    if (pendingList) return Promise.reject(new Error('正在读取烟花清单'));
    // 先登记 pending 再发送：响应可能在 send() 同步返回前抵达（测试
    // stub / 本地回环），后登记会丢包。
    const promise = new Promise<FireworksLibrary>((resolve, reject) => {
      pendingList = { resolve, reject, timer: armTimeout(reject) };
    });
    if (!options.send({ type: 'fireworks.list' })) {
      window.clearTimeout(pendingList!.timer);
      pendingList = null;
      return Promise.reject(new Error('当前离线，无法读取云端烟花'));
    }
    return promise;
  }

  function save(design: FireworkDesign, name: string, designId?: string): Promise<{ record: FireworkRecordView; replayed: boolean }> {
    const id = requestId();
    const promise = new Promise<{ record: FireworkRecordView; replayed: boolean }>((resolve, reject) => {
      pendingSaves.set(id, {
        resolve: (record) => resolve({ record, replayed: false }),
        reject,
        timer: armTimeout(reject),
      });
    });
    if (!options.send({ type: 'fireworks.save', requestId: id, designId, name, design })) {
      const pending = pendingSaves.get(id);
      if (pending) { window.clearTimeout(pending.timer); pendingSaves.delete(id); }
      return Promise.reject(new Error('当前离线，无法保存烟花'));
    }
    return promise;
  }

  function remove(designId: string): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      pendingDeletes.set(designId, { resolve, reject, timer: armTimeout(reject) });
    });
    if (!options.send({ type: 'fireworks.delete', designId })) {
      const pending = pendingDeletes.get(designId);
      if (pending) { window.clearTimeout(pending.timer); pendingDeletes.delete(designId); }
      return Promise.reject(new Error('当前离线，无法删除烟花'));
    }
    return promise;
  }

  function onLibraryChanged(listener: (revision: string) => void): () => void {
    libraryListeners.add(listener);
    return () => libraryListeners.delete(listener);
  }

  function dispose(): void {
    if (pendingList) window.clearTimeout(pendingList.timer);
    pendingList = null;
    for (const pending of pendingSaves.values()) window.clearTimeout(pending.timer);
    for (const pending of pendingDeletes.values()) window.clearTimeout(pending.timer);
    pendingSaves.clear();
    pendingDeletes.clear();
    libraryListeners.clear();
  }

  return { list, save, remove, handleServerMessage, onLibraryChanged, dispose };
}

export type FireworksClient = ReturnType<typeof createFireworksClient>;
