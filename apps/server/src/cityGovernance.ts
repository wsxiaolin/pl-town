import { createHash } from 'node:crypto';
import { db, getPlayerProgress } from './db.js';
import { CITY_CONSTRUCTION_CONFIG } from './data/cityConstructionConfig.js';
import { HttpBodyError } from './httpBody.js';
import type { PlayerProgress, User } from './types.js';

export const cityConfigJson = JSON.stringify(CITY_CONSTRUCTION_CONFIG);
export const cityConfigETag = `"${createHash('sha256').update(cityConfigJson).digest('hex')}"`;
export type CityState = {
  epoch: string; revision: number; configVersion: string;
  projects: Array<{ id: string; funded: number; built: boolean }>;
  decorations: Array<{ plotId: string; decorationId: string; ownerId: string; ownerNickname: string }>;
};
export function getCityState(): CityState {
  const meta = db.prepare('SELECT epoch, revision, config_version AS configVersion FROM city_meta WHERE id = 1').get() as Pick<CityState, 'epoch' | 'revision' | 'configVersion'>;
  const projects = db.prepare('SELECT id, funded, built FROM city_projects ORDER BY id').all() as Array<{ id: string; funded: number; built: number }>;
  const decorations = db.prepare('SELECT plot_id AS plotId, decoration_id AS decorationId, owner_id AS ownerId, owner_nickname AS ownerNickname FROM city_decorations ORDER BY plot_id').all() as CityState['decorations'];
  return { ...meta, projects: projects.map((entry) => ({ ...entry, built: Boolean(entry.built) })), decorations };
}
export function isCityBuildingBuilt(buildingId: string): boolean {
  const project = CITY_CONSTRUCTION_CONFIG.projects.find((entry) => entry.buildingId === buildingId);
  if (!project) return true;
  return Boolean((db.prepare('SELECT built FROM city_projects WHERE id = ?').get(project.id) as { built: number } | undefined)?.built);
}
export function isCityProjectBuilt(buildingId: string): boolean {
  return CITY_CONSTRUCTION_CONFIG.projects.some((entry) => entry.buildingId === buildingId) && isCityBuildingBuilt(buildingId);
}
export function mutateCity(user: User, kind: 'donate' | 'decorate', body: Record<string, unknown>): { state: CityState; progress: PlayerProgress; acceptedAmount: number; operationRevision: number; requestId: string; replayed: boolean } {
  if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(body.requestId)) throw new HttpBodyError('Invalid requestId', 400);
  const requestId = body.requestId;
  if (typeof body.configVersion !== 'string' || !body.configVersion || body.configVersion.length > 100) throw new HttpBodyError('Invalid configVersion', 400);
  const target = kind === 'donate' ? body.projectId : body.plotId;
  if (typeof target !== 'string' || target.length > 100) throw new HttpBodyError('Invalid target', 400);
  if (kind === 'donate' && (typeof body.amount !== 'number' || !Number.isSafeInteger(body.amount) || body.amount <= 0)) throw new HttpBodyError('Amount must be a positive safe integer', 400);
  if (kind === 'decorate' && (typeof body.decorationId !== 'string' || body.decorationId.length > 100)) throw new HttpBodyError('Invalid decorationId', 400);
  const fingerprint = JSON.stringify([kind, target, kind === 'donate' ? body.amount : body.decorationId, body.configVersion]);
  return db.transaction(() => {
    const previous = db.prepare('SELECT fingerprint, accepted_amount, revision FROM city_operations WHERE user_id = ? AND request_id = ?').get(user.id, requestId) as { fingerprint: string; accepted_amount: number; revision: number } | undefined;
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new HttpBodyError('requestId already used with different parameters', 409);
      return { state: getCityState(), progress: getPlayerProgress(user.id), acceptedAmount: previous.accepted_amount, operationRevision: previous.revision, requestId, replayed: true };
    }
    // New operations must use the current catalog version.
    if (body.configVersion !== CITY_CONSTRUCTION_CONFIG.version) throw new HttpBodyError('City config changed; reload config', 409);
    let acceptedAmount: number;
    if (kind === 'donate') {
      const project = CITY_CONSTRUCTION_CONFIG.projects.find((entry) => entry.id === target);
      if (!project) throw new HttpBodyError('Unknown project', 404);
      const row = db.prepare('SELECT funded, built FROM city_projects WHERE id = ?').get(target) as { funded: number; built: number };
      if (row.built || row.funded >= project.cost) throw new HttpBodyError('Project already built', 409);
      acceptedAmount = Math.min(body.amount as number, project.cost - row.funded);
      db.prepare('UPDATE city_projects SET funded = funded + ?, built = (funded + ? = ?) WHERE id = ?').run(acceptedAmount, acceptedAmount, project.cost, target);
    } else {
      const plot = CITY_CONSTRUCTION_CONFIG.personalPlots.find((entry) => entry.id === target);
      const decoration = CITY_CONSTRUCTION_CONFIG.decorations.find((entry) => entry.id === body.decorationId);
      if (!plot || !decoration) throw new HttpBodyError('Unknown plot or decoration', 404);
      if (!plot.options.includes(decoration.id)) throw new HttpBodyError('Decoration is not allowed on this plot', 400);
      if (db.prepare('SELECT 1 FROM city_decorations WHERE plot_id = ?').get(target)) throw new HttpBodyError('Plot already occupied', 409);
      acceptedAmount = decoration.cost;
      db.prepare('INSERT INTO city_decorations (plot_id, decoration_id, owner_id, owner_nickname) VALUES (?, ?, ?, ?)').run(target, decoration.id, user.id, user.nickname);
    }
    getPlayerProgress(user.id);
    const charged = db.prepare('UPDATE player_progress SET currency = currency - ?, updated_at = ? WHERE user_id = ? AND currency >= ?').run(acceptedAmount, new Date().toISOString(), user.id, acceptedAmount);
    if (!charged.changes) throw new HttpBodyError('Insufficient currency', 409);
    db.prepare('UPDATE city_meta SET revision = revision + 1 WHERE id = 1').run();
    const state = getCityState();
    db.prepare('INSERT INTO city_operations (user_id, request_id, fingerprint, accepted_amount, revision) VALUES (?, ?, ?, ?, ?)').run(user.id, requestId, fingerprint, acceptedAmount, state.revision);
    return { state, progress: getPlayerProgress(user.id), acceptedAmount, operationRevision: state.revision, requestId, replayed: false };
  }).immediate();
}
