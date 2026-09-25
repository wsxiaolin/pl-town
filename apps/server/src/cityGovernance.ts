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
  const decorations = db.prepare(`
    SELECT decorations.plot_id AS plotId, decorations.decoration_id AS decorationId,
      decorations.owner_id AS ownerId, COALESCE(users.nickname, decorations.owner_nickname) AS ownerNickname
    FROM city_decorations AS decorations
    LEFT JOIN users ON users.id = decorations.owner_id
    ORDER BY decorations.plot_id
  `).all() as CityState['decorations'];
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
  const areaRequest = kind === 'decorate' && body.areaId !== undefined;
  const target = kind === 'donate' ? body.projectId : areaRequest ? body.areaId : body.plotId;
  if (typeof target !== 'string' || target.length > 100) throw new HttpBodyError('Invalid target', 400);
  if (kind === 'donate' && (typeof body.amount !== 'number' || !Number.isSafeInteger(body.amount) || body.amount <= 0)) throw new HttpBodyError('Amount must be a positive safe integer', 400);
  if (kind === 'decorate' && (typeof body.decorationId !== 'string' || body.decorationId.length > 100)) throw new HttpBodyError('Invalid decorationId', 400);
  if (areaRequest && (body.plotId !== undefined || typeof body.quantity !== 'number' || !Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 100)) throw new HttpBodyError('Quantity must be an integer between 1 and 100; choose one area', 400);
  if (kind === 'decorate' && !areaRequest && body.quantity !== undefined) throw new HttpBodyError('Quantity requires an area', 400);
  // Keep the legacy fingerprint byte-for-byte compatible so old retries never charge again.
  const fingerprint = JSON.stringify(areaRequest
    ? ['decorate-area', target, body.decorationId, body.quantity, body.configVersion]
    : [kind, target, kind === 'donate' ? body.amount : body.decorationId, body.configVersion]);
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
      const decoration = CITY_CONSTRUCTION_CONFIG.decorations.find((entry) => entry.id === body.decorationId);
      if (!decoration) throw new HttpBodyError('Unknown plot or decoration', 404);
      const occupiedPlot = db.prepare('SELECT 1 FROM city_decorations WHERE plot_id = ?');
      const insertDecoration = db.prepare('INSERT INTO city_decorations (plot_id, decoration_id, owner_id, owner_nickname) VALUES (?, ?, ?, ?)');
      let plotIds: string[];
      if (areaRequest) {
        const area = CITY_CONSTRUCTION_CONFIG.personalAreas?.find((entry) => entry.id === target);
        if (!area) throw new HttpBodyError('Unknown construction area', 404);
        const available = area.plotIds.filter((id) => CITY_CONSTRUCTION_CONFIG.personalPlots.find((plot) => plot.id === id)?.options.includes(decoration.id)
          && !occupiedPlot.get(id));
        if (!available.length) throw new HttpBodyError('No available plots in this area', 409);
        if ((body.quantity as number) > available.length) throw new HttpBodyError('Not enough available plots in this area', 409);
        plotIds = available.slice(0, body.quantity as number);
      } else {
        const plot = CITY_CONSTRUCTION_CONFIG.personalPlots.find((entry) => entry.id === target);
        if (!plot) throw new HttpBodyError('Unknown plot or decoration', 404);
        if (!plot.options.includes(decoration.id)) throw new HttpBodyError('Decoration is not allowed on this plot', 400);
        if (occupiedPlot.get(target)) throw new HttpBodyError('Plot already occupied', 409);
        plotIds = [plot.id];
      }
      acceptedAmount = decoration.cost * plotIds.length;
      if (!Number.isSafeInteger(acceptedAmount)) throw new HttpBodyError('Invalid decoration total', 400);
      for (const id of plotIds) insertDecoration.run(id, decoration.id, user.id, user.nickname);
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
