type WindowState = { count: number; startedAt: number };

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, WindowState>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maximumKeys = 10_000,
  ) {}

  consume(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    let state = this.entries.get(key);
    if (!state || now - state.startedAt >= this.windowMs) state = { count: 0, startedAt: now };
    state.count += 1;
    this.entries.set(key, state);
    if (this.entries.size > this.maximumKeys) this.prune(now);
    const retryAfterSeconds = Math.max(1, Math.ceil((state.startedAt + this.windowMs - now) / 1_000));
    return { allowed: state.count <= this.limit, retryAfterSeconds };
  }

  prune(now = Date.now()): void {
    for (const [key, state] of this.entries) if (now - state.startedAt >= this.windowMs) this.entries.delete(key);
    if (this.entries.size <= this.maximumKeys) return;
    for (const key of this.entries.keys()) {
      this.entries.delete(key);
      if (this.entries.size <= this.maximumKeys) break;
    }
  }
}
