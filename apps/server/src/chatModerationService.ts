import {
  BIGMODEL_API_KEY,
  BIGMODEL_MODERATION_CONCURRENCY,
  BIGMODEL_MODERATION_TIMEOUT_MS,
  BIGMODEL_MODERATION_URL,
} from './config.js';
import { moderateText } from './contentModeration.js';
import * as db from './db.js';
import { logger } from './logger.js';

type PendingMessage = { id: number; text: string };

export class ChatModerationService {
  private readonly queue: PendingMessage[] = [];
  private readonly queuedIds = new Set<number>();
  private readonly stoppedWaiters: Array<() => void> = [];
  private active = 0;
  private stopping = false;

  constructor(private readonly onRejected: (messageId: number) => void) {}

  get enabled(): boolean { return Boolean(BIGMODEL_API_KEY); }

  start(): void {
    if (!this.enabled) {
      logger.warn('Chat moderation is disabled because BIGMODEL_API_KEY is not configured');
      return;
    }
    for (const message of db.listPendingChatModeration()) this.enqueue(message.id, message.text);
  }

  enqueue(id: number, text: string): void {
    if (!this.enabled || this.stopping || this.queuedIds.has(id)) return;
    this.queuedIds.add(id);
    this.queue.push({ id, text });
    this.drain();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    for (const message of this.queue) this.queuedIds.delete(message.id);
    this.queue.length = 0;
    if (this.active === 0) return;
    await new Promise<void>((resolve) => this.stoppedWaiters.push(resolve));
  }

  private drain(): void {
    while (!this.stopping && this.active < BIGMODEL_MODERATION_CONCURRENCY) {
      const message = this.queue.shift();
      if (!message) return;
      this.active += 1;
      void this.review(message).finally(() => {
        this.active -= 1;
        this.queuedIds.delete(message.id);
        if (this.stopping && this.active === 0) this.stoppedWaiters.splice(0).forEach((resolve) => resolve());
        else this.drain();
      });
    }
  }

  private async review(message: PendingMessage): Promise<void> {
    try {
      const decision = await moderateText({
        text: message.text,
        apiKey: BIGMODEL_API_KEY,
        url: BIGMODEL_MODERATION_URL,
        timeoutMs: BIGMODEL_MODERATION_TIMEOUT_MS,
      });
      if (!db.completeChatModeration(message.id, decision)) return;
      if (decision.rejected) {
        db.recordAdminAudit('system:bigmodel', 'chat.moderation.reject', String(message.id), {
          requestId: decision.requestId,
          riskTypes: decision.riskTypes,
        });
        logger.warn('Chat message rejected by content moderation', { messageId: message.id, riskTypes: decision.riskTypes });
        this.onRejected(message.id);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown moderation error';
      if (!db.failChatModeration(message.id, reason)) return;
      db.recordAdminAudit('system:bigmodel', 'chat.moderation.error', String(message.id), { reason });
      logger.error('Chat moderation failed', { messageId: message.id, error: reason });
    }
  }
}
