export class WorkQueueFullError extends Error {
  constructor(message = 'Server is busy; try again shortly') {
    super(message);
    this.name = 'WorkQueueFullError';
  }
}

export class AsyncGate {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly concurrency: number,
    private readonly maximumQueued: number,
  ) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.waiters.length >= this.maximumQueued) return Promise.reject(new WorkQueueFullError());
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.active -= 1;
  }
}
