import { closeSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

type LockRecord = { pid: number; nonce: string; role: string; createdAt: string };
let held: { path: string; nonce: string } | null = null;

const processIsAlive = (pid: number): boolean => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
};

export function acquireRuntimeLock(dataDirectory: string, role: 'server' | 'restore'): void {
  if (held) throw new Error('This process already holds a MiniCity runtime lock');
  const path = join(dataDirectory, '.minicity-runtime.lock');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nonce = randomUUID();
    let descriptor: number | undefined;
    try {
      descriptor = openSync(path, 'wx', 0o600);
      const record: LockRecord = { pid: process.pid, nonce, role, createdAt: new Date().toISOString() };
      writeFileSync(descriptor, `${JSON.stringify(record)}\n`, 'utf8');
      closeSync(descriptor); descriptor = undefined;
      held = { path, nonce };
      return;
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      let existing: Partial<LockRecord> = {};
      try { existing = JSON.parse(readFileSync(path, 'utf8')) as Partial<LockRecord>; } catch { /* malformed locks are stale */ }
      if (typeof existing.pid === 'number' && processIsAlive(existing.pid)) {
        throw new Error(`MiniCity ${existing.role ?? 'server'} process ${existing.pid} is using this data directory`);
      }
      rmSync(path, { force: true });
    }
  }
  throw new Error('Could not acquire the MiniCity runtime lock');
}

export function releaseRuntimeLock(): void {
  const lock = held;
  held = null;
  if (!lock) return;
  try {
    const existing = JSON.parse(readFileSync(lock.path, 'utf8')) as Partial<LockRecord>;
    if (existing.nonce === lock.nonce) rmSync(lock.path, { force: true });
  } catch { /* lock already removed */ }
}

process.once('exit', releaseRuntimeLock);
