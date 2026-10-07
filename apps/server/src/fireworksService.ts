import {
  FIREWORK_SAVE_PRICE,
  sanitizeFireworkDesign,
  sanitizeFireworkName,
} from './fireworks.js';
import {
  deleteFireworkDesign,
  fireworkLibraryRevision,
  listFireworkDesigns,
  saveFireworkDesign,
} from './dbFireworks.js';
import type { User } from './types.js';

/**
 * 烟花 WS 协议处理（transport 无关，便于测试）。消息语义：
 * - `fireworks.list`：自己的全部 + 全体居民最新 200 份（观景台节目单）。
 * - `fireworks.save`：存云端，收 FIREWORK_SAVE_PRICE 金币；requestId 幂等，
 *   重试重放回执不重复扣款；成功后向全体广播 fireworks.library 修订号。
 * - `fireworks.delete`：删除自己的设计（免费，金币不退）。
 */

export type FireworksClientMessage =
  | { type: 'fireworks.list' }
  | { type: 'fireworks.save'; requestId?: unknown; designId?: unknown; name?: unknown; design?: unknown }
  | { type: 'fireworks.delete'; designId?: unknown };

export type FireworksDeps = {
  send: (socket: unknown, payload: Record<string, unknown>) => void;
  fail: (socket: unknown, message: string) => void;
  broadcast: (payload: Record<string, unknown>) => void;
  socket: unknown;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

export function handleFireworksMessage(user: User, raw: FireworksClientMessage, deps: FireworksDeps): void {
  if (raw.type === 'fireworks.list') {
    deps.send(deps.socket, { type: 'fireworks.listed', ...listFireworkDesigns(user.id), revision: fireworkLibraryRevision() });
    return;
  }
  if (raw.type === 'fireworks.save') {
    if (typeof raw.requestId !== 'string' || !REQUEST_ID_PATTERN.test(raw.requestId)) {
      deps.fail(deps.socket, 'Invalid requestId');
      return;
    }
    const name = sanitizeFireworkName(raw.name);
    const design = sanitizeFireworkDesign(raw.design);
    if (!name) {
      deps.fail(deps.socket, 'Invalid firework name');
      return;
    }
    if (!design) {
      deps.fail(deps.socket, 'Invalid firework design');
      return;
    }
    const designId = typeof raw.designId === 'string' && raw.designId.length <= 100 ? raw.designId : null;
    try {
      const result = saveFireworkDesign(user.id, user.nickname, raw.requestId, name, design, designId);
      deps.send(deps.socket, {
        type: 'fireworks.saved',
        requestId: raw.requestId,
        record: result.record,
        replayed: result.replayed,
        pricePaid: result.pricePaid,
        progress: result.progress,
      });
      // 有新的云端烟花：广播修订号，让打开着的观景台/设计器刷新节目单
      // （幂等重放不改变库存，不广播）。
      if (!result.replayed) {
        deps.broadcast({ type: 'fireworks.library', revision: fireworkLibraryRevision() });
      }
    } catch (error) {
      deps.fail(deps.socket, error instanceof Error ? error.message : 'Could not save firework design');
    }
    return;
  }
  if (raw.type === 'fireworks.delete') {
    if (typeof raw.designId !== 'string' || raw.designId.length === 0 || raw.designId.length > 100) {
      deps.fail(deps.socket, 'Invalid firework design');
      return;
    }
    try {
      const deleted = deleteFireworkDesign(user.id, raw.designId);
      if (!deleted) {
        deps.fail(deps.socket, 'Firework design is not available');
        return;
      }
      deps.send(deps.socket, { type: 'fireworks.deleted', designId: raw.designId });
      deps.broadcast({ type: 'fireworks.library', revision: fireworkLibraryRevision() });
    } catch (error) {
      deps.fail(deps.socket, error instanceof Error ? error.message : 'Could not delete firework design');
    }
  }
}

export { FIREWORK_SAVE_PRICE };
