import { createWriteStream, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOG_DIR } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const THRESHOLD = ORDER[process.env.LOG_LEVEL as LogLevel] ?? ORDER.info;
const LOG_RETENTION_DAYS = 30;

let currentDay = '';
let fileStream: ReturnType<typeof createWriteStream> | null = null;

const pruneOldLogs = () => {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 86_400_000;
  let names: string[];
  try { names = readdirSync(LOG_DIR); } catch { return; }
  for (const name of names) {
    if (!name.startsWith('server-') || !name.endsWith('.log')) continue;
    try { const file = join(LOG_DIR, name); if (statSync(file).mtimeMs < cutoff) rmSync(file, { force: true }); } catch { /* ignore */ }
  }
};

const rotate = () => {
  if (fileStream) fileStream.end();
  currentDay = new Date().toISOString().slice(0, 10);
  fileStream = createWriteStream(join(LOG_DIR, `server-${currentDay}.log`), { flags: 'a' });
  pruneOldLogs();
};

const formatDetails = (details: unknown): string => {
  if (details === undefined) return '';
  try { return ` ${JSON.stringify(details)}`; } catch { return ` ${String(details)}`; }
};

const write = (level: LogLevel, message: string, details?: unknown) => {
  if (ORDER[level] < THRESHOLD) return;
  const now = new Date();
  if (now.toISOString().slice(0, 10) !== currentDay) rotate();
  const line = `[${now.toISOString()}] [${level.toUpperCase()}] ${message}${formatDetails(details)}\n`;
  if (process.stdout.isTTY) {
    const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : level === 'debug' ? '\x1b[90m' : '\x1b[36m';
    process.stdout.write(`${color}${line}\x1b[0m`);
  } else {
    process.stdout.write(line);
  }
  if (!fileStream) rotate();
  fileStream?.write(line);
};

export const logger = {
  debug: (message: string, details?: unknown) => write('debug', message, details),
  info: (message: string, details?: unknown) => write('info', message, details),
  warn: (message: string, details?: unknown) => write('warn', message, details),
  error: (message: string, details?: unknown) => write('error', message, details),
};