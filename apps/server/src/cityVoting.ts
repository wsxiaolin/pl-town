import { db } from './db.js';
import { getCityState } from './cityGovernance.js';
import { CITY_CONSTRUCTION_CONFIG } from './data/cityConstructionConfig.js';
import { HttpBodyError } from './httpBody.js';
import type { User } from './types.js';

export function getCityVotes(userId: string) {
  // Both reads are synchronous on the single-process SQLite connection: no
  // restore or vote can interleave between them within this event-loop turn.
  const { epoch } = db.prepare('SELECT epoch FROM city_meta WHERE id = 1').get() as { epoch: string };
  const rows = db.prepare('SELECT project_id FROM city_votes WHERE user_id = ? ORDER BY project_id').all(userId) as Array<{ project_id: string }>;
  return { epoch, projectIds: rows.map((row) => row.project_id) };
}

export function voteCity(user: User, body: Record<string, unknown>) {
  // Votes have both per-project uniqueness and request receipts, but never
  // charge currency. Keep that transaction distinct from construction payment.
  if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(body.requestId)) throw new HttpBodyError('Invalid requestId', 400);
  if (typeof body.projectId !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(body.projectId)) throw new HttpBodyError('Invalid projectId', 400);
  if (typeof body.configVersion !== 'string' || !body.configVersion || body.configVersion.length > 100) throw new HttpBodyError('Invalid configVersion', 400);
  const { requestId, projectId } = body;
  const fingerprint = JSON.stringify([projectId, body.configVersion]);
  return db.transaction(() => {
    const result = (revision: number, replayed: boolean) => ({ kind: 'vote' as const, state: getCityState(), votes: getCityVotes(user.id), operationRevision: revision, requestId, replayed });
    const previous = db.prepare('SELECT fingerprint, revision FROM city_vote_operations WHERE user_id = ? AND request_id = ?').get(user.id, requestId) as { fingerprint: string; revision: number } | undefined;
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new HttpBodyError('requestId already used with different parameters', 409);
      return result(previous.revision, true);
    }
    if (body.configVersion !== CITY_CONSTRUCTION_CONFIG.version) throw new HttpBodyError('City config changed; reload config', 409);
    const project = CITY_CONSTRUCTION_CONFIG.projects.find((entry) => entry.id === projectId);
    if (!project) throw new HttpBodyError('Unknown project', 404);
    if (project.kind !== 'building') throw new HttpBodyError('Only building projects accept votes', 400);
    const existing = db.prepare('SELECT revision FROM city_votes WHERE user_id = ? AND project_id = ?').get(user.id, projectId) as { revision: number } | undefined;
    // Preserve all request receipts so a delayed retry never casts an extra vote.
    const recordReceipt = (revision: number, replayed: boolean) => {
      db.prepare('INSERT INTO city_vote_operations (user_id, request_id, fingerprint, revision) VALUES (?, ?, ?, ?)').run(user.id, requestId, fingerprint, revision);
      return result(revision, replayed);
    };
    if (existing) return recordReceipt(existing.revision, true);
    const row = db.prepare('SELECT built FROM city_projects WHERE id = ?').get(projectId) as { built: number } | undefined;
    if (!row) throw new HttpBodyError('Unknown project', 404);
    if (row.built) throw new HttpBodyError('Project already built', 409);
    db.prepare('UPDATE city_meta SET revision = revision + 1 WHERE id = 1').run();
    const { revision } = db.prepare('SELECT revision FROM city_meta WHERE id = 1').get() as { revision: number };
    db.prepare('INSERT INTO city_votes (user_id, project_id, revision) VALUES (?, ?, ?)').run(user.id, projectId, revision);
    return recordReceipt(revision, false);
  }).immediate();
}
