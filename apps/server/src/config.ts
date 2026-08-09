import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PORT = Number(process.env.PORT ?? 8787);
export const HOST = process.env.HOST ?? '0.0.0.0';
export const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data');
export const LOG_DIR = resolve(process.env.LOG_DIR ?? join(DATA_DIR, 'logs'));
export const DATABASE_PATH = resolve(DATA_DIR, 'minicity.sqlite');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });
