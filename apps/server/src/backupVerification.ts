import { Worker } from 'node:worker_threads';

export type BackupVerification = { sha256: string; integrity: string; foreignKeyErrors: number; userVersion: number; applicationId: number };

export function verifyBackup(path: string): Promise<BackupVerification> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./backupVerifier.js', import.meta.url), { workerData: { path } });
    worker.once('message', (result: BackupVerification) => resolve(result));
    worker.once('error', reject);
    worker.once('exit', (code) => { if (code !== 0) reject(new Error(`Backup verifier exited with code ${code}`)); });
  });
}
