import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { MINICITY_APPLICATION_ID, MINICITY_SCHEMA_VERSION } from './databaseMetadata.js';

type Input = { path: string };
type Result = { sha256: string; integrity: string; foreignKeyErrors: number; userVersion: number; applicationId: number };

const input = workerData as Input;
const database = new Database(input.path, { readonly: true, fileMustExist: true });
let integrity = '';
let foreignKeyErrors = 0;
let userVersion = 0;
let applicationId = 0;
try {
  integrity = String(database.pragma('integrity_check', { simple: true }));
  foreignKeyErrors = (database.pragma('foreign_key_check') as unknown[]).length;
  userVersion = Number(database.pragma('user_version', { simple: true })) || 0;
  applicationId = Number(database.pragma('application_id', { simple: true })) || 0;
  if (applicationId !== MINICITY_APPLICATION_ID || userVersion > MINICITY_SCHEMA_VERSION) integrity = 'unsupported_database';
} finally { database.close(); }

const hash = createHash('sha256');
const stream = createReadStream(input.path);
stream.on('data', (chunk) => hash.update(chunk));
stream.once('error', (error) => { throw error; });
stream.once('end', () => {
  const result: Result = { sha256: hash.digest('hex'), integrity, foreignKeyErrors, userVersion, applicationId };
  parentPort?.postMessage(result);
});
