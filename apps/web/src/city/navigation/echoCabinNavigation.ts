import * as THREE from 'three';

type WalkBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type ObstacleRect = WalkBounds;

export type EchoCabinNavigation = {
  buildPath(from: THREE.Vector3, rawTarget: THREE.Vector3): THREE.Vector3[];
  contains(point: THREE.Vector3, padding?: number): boolean;
  clampToWalkable(point: THREE.Vector3): THREE.Vector3;
  refresh(): void;
};

export type EchoCabinNavigationOptions = {
  getInterior: () => THREE.Object3D | null | undefined;
  fallbackBounds: WalkBounds;
  playerRadius?: number;
};

const EPSILON = 0.06;
const PLAYER_COLLISION_HEIGHT = 2.8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampPoint(point: THREE.Vector3, bounds: WalkBounds): THREE.Vector3 {
  return new THREE.Vector3(
    clamp(point.x, bounds.minX, bounds.maxX),
    0,
    clamp(point.z, bounds.minZ, bounds.maxZ),
  );
}

function containsPoint(rect: WalkBounds, point: THREE.Vector3, padding = 0): boolean {
  return point.x >= rect.minX - padding
    && point.x <= rect.maxX + padding
    && point.z >= rect.minZ - padding
    && point.z <= rect.maxZ + padding;
}

function rectContainsRect(outer: ObstacleRect, inner: ObstacleRect): boolean {
  return inner.minX >= outer.minX
    && inner.maxX <= outer.maxX
    && inner.minZ >= outer.minZ
    && inner.maxZ <= outer.maxZ;
}

function segmentIntersectsRect(from: THREE.Vector3, to: THREE.Vector3, rect: ObstacleRect): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let near = 0;
  let far = 1;

  const clip = (origin: number, delta: number, min: number, max: number): boolean => {
    if (Math.abs(delta) < 1e-8) return origin >= min && origin <= max;
    const inverse = 1 / delta;
    let first = (min - origin) * inverse;
    let second = (max - origin) * inverse;
    if (first > second) [first, second] = [second, first];
    near = Math.max(near, first);
    far = Math.min(far, second);
    return near <= far;
  };

  return clip(from.x, dx, rect.minX, rect.maxX)
    && clip(from.z, dz, rect.minZ, rect.maxZ)
    && far >= 0
    && near <= 1;
}

export function createEchoCabinNavigation(options: EchoCabinNavigationOptions): EchoCabinNavigation {
  const playerRadius = options.playerRadius ?? 0.52;
  const meshBox = new THREE.Box3();
  let bounds = { ...options.fallbackBounds };
  let obstacles: ObstacleRect[] = [];
  let cachedInterior: THREE.Object3D | null = null;
  let cachedChildCount = -1;

  function isWalkable(point: THREE.Vector3): boolean {
    return containsPoint(bounds, point) && !obstacles.some((obstacle) => containsPoint(obstacle, point));
  }

  function rebuild(): void {
    const interior = options.getInterior() ?? null;
    cachedInterior = interior;
    cachedChildCount = interior?.children.length ?? -1;
    bounds = { ...options.fallbackBounds };
    obstacles = [];
    if (!interior) return;

    interior.updateWorldMatrix(true, true);
    const meshes: Array<{ object: THREE.Mesh; box: THREE.Box3 }> = [];
    interior.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.echoInteriorRoof) return;
      meshBox.setFromObject(object);
      if (meshBox.isEmpty()) return;
      meshes.push({ object, box: meshBox.clone() });
    });

    const floor = meshes
      .filter(({ object, box }) => object.userData.echoInteriorFloor || box.max.y <= 0.25)
      .sort((left, right) => {
        const leftExplicit = left.object.userData.echoInteriorFloor ? 1 : 0;
        const rightExplicit = right.object.userData.echoInteriorFloor ? 1 : 0;
        if (leftExplicit !== rightExplicit) return rightExplicit - leftExplicit;
        const leftArea = (left.box.max.x - left.box.min.x) * (left.box.max.z - left.box.min.z);
        const rightArea = (right.box.max.x - right.box.min.x) * (right.box.max.z - right.box.min.z);
        return rightArea - leftArea;
      })[0];

    const configuredBounds = interior.userData.echoInteriorWalkable;
    if (configuredBounds
      && Number.isFinite(configuredBounds.minX)
      && Number.isFinite(configuredBounds.maxX)
      && Number.isFinite(configuredBounds.minZ)
      && Number.isFinite(configuredBounds.maxZ)) {
      const localCorners = [
        new THREE.Vector3(configuredBounds.minX, 0, configuredBounds.minZ),
        new THREE.Vector3(configuredBounds.minX, 0, configuredBounds.maxZ),
        new THREE.Vector3(configuredBounds.maxX, 0, configuredBounds.minZ),
        new THREE.Vector3(configuredBounds.maxX, 0, configuredBounds.maxZ),
      ];
      localCorners.forEach((corner) => interior.localToWorld(corner));
      bounds = {
        minX: Math.min(...localCorners.map((corner) => corner.x)),
        maxX: Math.max(...localCorners.map((corner) => corner.x)),
        minZ: Math.min(...localCorners.map((corner) => corner.z)),
        maxZ: Math.max(...localCorners.map((corner) => corner.z)),
      };
    }
    if (floor) {
      const floorBounds = {
        minX: floor.box.min.x + playerRadius,
        maxX: floor.box.max.x - playerRadius,
        minZ: floor.box.min.z + playerRadius,
        maxZ: floor.box.max.z - playerRadius,
      };
      // Explicit walkable metadata is authoritative, but never let it extend
      // beyond the actual floor mesh when a visual variant is smaller.
      if (!configuredBounds) bounds = floorBounds;
      else {
        bounds.minX = Math.max(bounds.minX, floorBounds.minX);
        bounds.maxX = Math.min(bounds.maxX, floorBounds.maxX);
        bounds.minZ = Math.max(bounds.minZ, floorBounds.minZ);
        bounds.maxZ = Math.min(bounds.maxZ, floorBounds.maxZ);
      }
    }

    const roomWidth = bounds.maxX - bounds.minX;
    const roomDepth = bounds.maxZ - bounds.minZ;
    const rawObstacles: ObstacleRect[] = [];

    meshes.forEach(({ object, box }) => {
      if (object === floor?.object || object.userData.echoCabinWalkable || object.userData.echoInteriorWall) return;
      if (object.userData.echoInteriorObstacle === false) return;
      if (box.max.y <= 0.05 || box.min.y > PLAYER_COLLISION_HEIGHT) return;

      const width = box.max.x - box.min.x;
      const depth = box.max.z - box.min.z;
      const spansRoom = width >= roomWidth * 0.78 || depth >= roomDepth * 0.78;
      const wallLike = spansRoom && Math.min(width, depth) <= 0.85;
      if (wallLike && object.userData.echoInteriorObstacle !== true) return;

      const obstacle = {
        minX: Math.max(bounds.minX, box.min.x - playerRadius),
        maxX: Math.min(bounds.maxX, box.max.x + playerRadius),
        minZ: Math.max(bounds.minZ, box.min.z - playerRadius),
        maxZ: Math.min(bounds.maxZ, box.max.z + playerRadius),
      };
      if (obstacle.maxX - obstacle.minX <= EPSILON || obstacle.maxZ - obstacle.minZ <= EPSILON) return;
      rawObstacles.push(obstacle);
    });

    obstacles = rawObstacles.filter((candidate, index) => !rawObstacles.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      const candidateArea = (candidate.maxX - candidate.minX) * (candidate.maxZ - candidate.minZ);
      const otherArea = (other.maxX - other.minX) * (other.maxZ - other.minZ);
      return otherArea > candidateArea && rectContainsRect(other, candidate);
    }));
  }

  function refresh(): void {
    const interior = options.getInterior() ?? null;
    if (interior !== cachedInterior || (interior?.children.length ?? -1) !== cachedChildCount) rebuild();
  }

  function nearestWalkable(rawPoint: THREE.Vector3): THREE.Vector3 {
    const point = clampPoint(rawPoint, bounds);
    if (isWalkable(point)) return point;

    const step = 0.35;
    for (let ring = 1; ring <= 24; ring += 1) {
      const distance = ring * step;
      const samples = Math.max(12, ring * 6);
      for (let sample = 0; sample < samples; sample += 1) {
        const angle = (sample / samples) * Math.PI * 2;
        const candidate = clampPoint(new THREE.Vector3(
          point.x + Math.cos(angle) * distance,
          0,
          point.z + Math.sin(angle) * distance,
        ), bounds);
        if (isWalkable(candidate)) return candidate;
      }
    }
    return point;
  }

  function segmentIsClear(from: THREE.Vector3, to: THREE.Vector3): boolean {
    if (!containsPoint(bounds, from) || !containsPoint(bounds, to)) return false;
    return !obstacles.some((obstacle) => segmentIntersectsRect(from, to, obstacle));
  }

  function gridFallback(start: THREE.Vector3, target: THREE.Vector3): THREE.Vector3[] {
    const cellSize = 0.7;
    const columns = Math.ceil((bounds.maxX - bounds.minX) / cellSize) + 1;
    const rows = Math.ceil((bounds.maxZ - bounds.minZ) / cellSize) + 1;
    const toCell = (point: THREE.Vector3) => ({
      x: clamp(Math.round((point.x - bounds.minX) / cellSize), 0, columns - 1),
      z: clamp(Math.round((point.z - bounds.minZ) / cellSize), 0, rows - 1),
    });
    const toPoint = (cell: { x: number; z: number }) => new THREE.Vector3(
      clamp(bounds.minX + cell.x * cellSize, bounds.minX, bounds.maxX),
      0,
      clamp(bounds.minZ + cell.z * cellSize, bounds.minZ, bounds.maxZ),
    );
    const startCell = toCell(start);
    const targetCell = toCell(target);
    const key = (cell: { x: number; z: number }) => `${cell.x},${cell.z}`;
    const blocked = new Set<string>();
    for (let x = 0; x < columns; x += 1) {
      for (let z = 0; z < rows; z += 1) {
        if (!isWalkable(toPoint({ x, z }))) blocked.add(`${x},${z}`);
      }
    }
    const nearestOpen = (origin: { x: number; z: number }) => {
      if (!blocked.has(key(origin))) return origin;
      for (let radius = 1; radius < Math.max(columns, rows); radius += 1) {
        for (let x = Math.max(0, origin.x - radius); x <= Math.min(columns - 1, origin.x + radius); x += 1) {
          for (let z = Math.max(0, origin.z - radius); z <= Math.min(rows - 1, origin.z + radius); z += 1) {
            const candidate = { x, z };
            if (!blocked.has(key(candidate))) return candidate;
          }
        }
      }
      return origin;
    };
    const startOpen = nearestOpen(startCell);
    const targetOpen = nearestOpen(targetCell);
    const startKey = key(startOpen);
    const targetKey = key(targetOpen);
    const open = [startOpen];
    const cameFrom = new Map<string, { x: number; z: number }>();
    const cost = new Map<string, number>([[startKey, 0]]);
    const heuristic = (cell: { x: number; z: number }) => Math.hypot(cell.x - targetOpen.x, cell.z - targetOpen.z);
    const directions = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
    ] as const;
    while (open.length) {
      let bestIndex = 0;
      for (let index = 1; index < open.length; index += 1) {
        const currentCost = cost.get(key(open[index]!)) ?? Infinity;
        const bestCost = cost.get(key(open[bestIndex]!)) ?? Infinity;
        if (currentCost + heuristic(open[index]!) < bestCost + heuristic(open[bestIndex]!)) bestIndex = index;
      }
      const current = open.splice(bestIndex, 1)[0]!;
      if (key(current) === targetKey) break;
      directions.forEach(([dx, dz]) => {
        const next = { x: current.x + dx, z: current.z + dz };
        if (next.x < 0 || next.x >= columns || next.z < 0 || next.z >= rows || blocked.has(key(next))) return;
        const nextKey = key(next);
        const nextCost = (cost.get(key(current)) ?? Infinity) + Math.hypot(dx, dz);
        if (nextCost >= (cost.get(nextKey) ?? Infinity)) return;
        cost.set(nextKey, nextCost);
        cameFrom.set(nextKey, current);
        if (!open.some((candidate) => key(candidate) === nextKey)) open.push(next);
      });
    }
    if (!cost.has(targetKey)) return [];
    const cells: Array<{ x: number; z: number }> = [];
    for (let current = targetOpen; ; current = cameFrom.get(key(current))!) {
      cells.unshift(current);
      if (key(current) === startKey) break;
      if (!cameFrom.has(key(current))) return [];
    }
    const points = cells.map(toPoint);
    const result: THREE.Vector3[] = [];
    let anchor = start;
    for (let index = 0; index < points.length; index += 1) {
      let furthest = index;
      for (let candidate = points.length - 1; candidate > index; candidate -= 1) {
        if (segmentIsClear(anchor, points[candidate]!)) {
          furthest = candidate;
          break;
        }
      }
      result.push(points[furthest]!);
      anchor = points[furthest]!;
      index = furthest;
    }
    const last = result[result.length - 1] ?? start;
    if (last.distanceToSquared(target) > cellSize * cellSize * 2 && segmentIsClear(last, target)) result.push(target);
    return result;
  }

  function buildPath(from: THREE.Vector3, rawTarget: THREE.Vector3): THREE.Vector3[] {
    refresh();
    const start = nearestWalkable(from);
    const target = nearestWalkable(rawTarget);
    if (start.distanceToSquared(target) < 0.0025) return [];
    if (segmentIsClear(start, target)) return [target];

    const nodes = [start, target];
    obstacles.forEach((obstacle) => {
      const corners = [
        [obstacle.minX - EPSILON, obstacle.minZ - EPSILON],
        [obstacle.minX - EPSILON, obstacle.maxZ + EPSILON],
        [obstacle.maxX + EPSILON, obstacle.minZ - EPSILON],
        [obstacle.maxX + EPSILON, obstacle.maxZ + EPSILON],
      ] as const;
      corners.forEach(([x, z]) => {
        const corner = new THREE.Vector3(x, 0, z);
        if (isWalkable(corner)) nodes.push(corner);
      });
    });

    const distances = new Array<number>(nodes.length).fill(Infinity);
    const previous = new Array<number>(nodes.length).fill(-1);
    const open = new Set(nodes.map((_, index) => index));
    distances[0] = 0;

    while (open.size) {
      let current = -1;
      let best = Infinity;
      open.forEach((index) => {
        if (distances[index]! < best) {
          best = distances[index]!;
          current = index;
        }
      });
      if (current < 0 || current === 1) break;
      open.delete(current);

      open.forEach((neighbor) => {
        if (!segmentIsClear(nodes[current]!, nodes[neighbor]!)) return;
        const candidate = distances[current]! + nodes[current]!.distanceTo(nodes[neighbor]!);
        if (candidate >= distances[neighbor]!) return;
        distances[neighbor] = candidate;
        previous[neighbor] = current;
      });
    }

    if (!Number.isFinite(distances[1]!)) return gridFallback(start, target);
    const path: THREE.Vector3[] = [];
    for (let current = 1; current > 0; current = previous[current]!) path.unshift(nodes[current]!.clone());

    const smoothed: THREE.Vector3[] = [];
    let anchor = start;
    for (let index = 0; index < path.length; index += 1) {
      let furthest = index;
      for (let candidate = path.length - 1; candidate > index; candidate -= 1) {
        if (segmentIsClear(anchor, path[candidate]!)) {
          furthest = candidate;
          break;
        }
      }
      smoothed.push(path[furthest]!);
      anchor = path[furthest]!;
      index = furthest;
    }
    return smoothed;
  }

  return {
    buildPath,
    contains(point, padding = 0) {
      refresh();
      return containsPoint(bounds, point, padding);
    },
    clampToWalkable(point) {
      refresh();
      return nearestWalkable(point);
    },
    refresh: rebuild,
  };
}
