import * as THREE from 'three';
import type { TerrainFeatureConfig } from '../../city/data/terrain/_types';
import { fbm2, hashString, smoothStep } from '../../city/data/terrain/heightfield/noiseCore';

type Ridge = { ax: number; az: number; bx: number; bz: number; a: number; b: number; width: number };
export type AlpineRangeField = {
  bounds: { x0: number; x1: number; z0: number; z1: number };
  heightAt(x: number, z: number): number;
};

const noise = (x: number, z: number, seed: number, scale: number, octaves = 3): number =>
  fbm2(x / scale, z / scale, seed, 65536, octaves);

/** One scalar surface for the entire range, including saddles and foothills. */
export function createAlpineRangeField(features: readonly TerrainFeatureConfig[]): AlpineRangeField {
  const peaks = [...new Map(features.filter((feature) => feature.kind === 'mountain')
    .map(feature => [feature.id, feature])).values()];
  if (peaks.length === 0) throw new Error('Alpine range requires mountain features');
  const bounds = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  const ridges: Ridge[] = [];
  const benches = [...peaks].sort((a, b) => (b.height ?? 0) - (a.height ?? 0)).slice(0, 3)
    .map((peak, index) => ({
      x: peak.x + (peak.width ?? 20) * [-0.19, 0.22, -0.14][index]!,
      z: peak.z + (peak.depth ?? 20) * [0.24, 0.13, 0.29][index]!,
      rx: (peak.width ?? 20) * [0.20, 0.16, 0.18][index]!,
      rz: (peak.depth ?? 20) * [0.12, 0.16, 0.11][index]!,
      y: (peak.height ?? 12) * [0.36, 0.43, 0.31][index]!,
      angle: [-0.42, 0.61, -0.78][index]!,
      tilt: [0.12, -0.16, 0.09][index]!,
    }));
  for (const peak of peaks) {
    const rx = (peak.width ?? 20) / 2;
    const rz = (peak.depth ?? peak.width ?? 20) / 2;
    bounds.x0 = Math.min(bounds.x0, peak.x - rx - 14);
    bounds.x1 = Math.max(bounds.x1, peak.x + rx + 14);
    bounds.z0 = Math.min(bounds.z0, peak.z - rz - 14);
    bounds.z1 = Math.min(-110, Math.max(bounds.z1, peak.z + rz + 14));
    const seed = hashString(peak.id);
    const height = peak.height ?? 12;
    // An offset, broken crest with unequal shoulders and downhill spur ridges.
    const crestX = peak.x - rx * 0.13;
    const crestZ = peak.z - rz * 0.12;
    for (let spur = 0; spur < 3; spur += 1) {
      const angle = [-2.72, -0.38, 1.64][spur]! + (seed % 31) * 0.013;
      const shoulderX = peak.x + Math.cos(angle) * rx * [0.94, 0.78, 0.68][spur]!;
      const shoulderZ = peak.z + Math.sin(angle) * rz * 0.86;
      ridges.push({ ax: crestX, az: crestZ, bx: shoulderX, bz: shoulderZ,
        a: height * 0.70, b: 0, width: rz * 0.32 });
      for (const fraction of [0.37, 0.69]) {
        const ax = crestX + (shoulderX - crestX) * fraction;
        const az = crestZ + (shoulderZ - crestZ) * fraction;
        const branchAngle = angle + (spur === 1 ? -0.84 : 0.67);
        ridges.push({ ax, az, bx: ax + Math.cos(branchAngle) * rx * 0.42,
          bz: az + Math.sin(branchAngle) * rz * 0.51, a: height * (0.58 - fraction * 0.40),
          b: 0, width: rx * 0.18 });
      }
    }
  }
  // A minimum spanning tree joins every configured mountain into one landform.
  const connected = [peaks[0]!];
  const remaining = peaks.slice(1);
  while (remaining.length) {
    let best = Infinity;
    let target = 0;
    let source = connected[0]!;
    for (const a of connected) {
      remaining.forEach((b, index) => {
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        if (distance < best) { best = distance; target = index; source = a; }
      });
    }
    const next = remaining.splice(target, 1)[0]!;
    const low = Math.min(source.height ?? 12, next.height ?? 12);
    ridges.push({ ax: source.x, az: source.z, bx: next.x, bz: next.z,
      a: low * 0.35, b: low * 0.35,
      width: Math.min(source.depth ?? 20, next.depth ?? 20) * 0.36 });
    connected.push(next);
  }

  return {
    bounds,
    heightAt(x, z) {
      const edge = Math.min(x - bounds.x0, bounds.x1 - x, z - bounds.z0, bounds.z1 - z);
      if (edge <= 0) return 0;
      const warp = noise(x, z, 0x7193, 45) * 0.025;
      let elevation = 0;
      for (const peak of peaks) {
        const rx = (peak.width ?? 20) / 2;
        const rz = (peak.depth ?? peak.width ?? 20) / 2;
        const px = (x - peak.x + rx * 0.11) / rx;
        const pz = (z - peak.z + rz * 0.09) / rz;
        const u = px + pz * 0.26;
        const v = pz - px * 0.18;
        // Unequal planar faces meet at an eccentric, sharply tapered summit.
        const radius = Math.abs(u) * (u < 0 ? 0.84 : 1.08)
          + Math.abs(v) * (v < 0 ? 0.95 : 0.79);
        const profile = Math.max(0, 1 - radius * (1 + warp));
        const angle = Math.atan2(v, u);
        const phase = (hashString(peak.id) % 4096) * 0.013;
        // Integer angular frequencies close the atan2 seam. Radial warping bends
        // tributaries into the larger gullies, while the summit and toe stay intact.
        const bend = Math.sin(radius * 9 + phase) * 0.48
          + Math.sin(angle * 3 + phase) * 0.32;
        const trunk = Math.sin(angle * 7 + bend + phase);
        const tributary = Math.sin(angle * 13 - radius * 13 + bend * 1.7 + phase);
        const ribs = Math.sin(angle * 21 + radius * 19 + phase);
        const erosion = trunk * 0.080 + tributary * 0.032 + ribs * 0.012;
        const slopeMask = smoothStep(0.06, 0.28, profile) * (1 - smoothStep(0.55, 0.88, profile));
        const carved = Math.pow(profile, 1.12) + erosion * slopeMask;
        elevation = Math.max(elevation, (peak.height ?? 12) * Math.max(0, carved));
      }
      for (const ridge of ridges) {
        const dx = ridge.bx - ridge.ax;
        const dz = ridge.bz - ridge.az;
        const length = Math.hypot(dx, dz);
        if (length < 0.001) continue;
        const t = Math.max(0, Math.min(1, ((x - ridge.ax) * dx + (z - ridge.az) * dz) / (length * length)));
        const px = ridge.ax + dx * t;
        const pz = ridge.az + dz * t;
        const distance = Math.hypot(x - px, z - pz);
        const profile = Math.max(0, 1 - distance / ridge.width);
        const h = (ridge.a + (ridge.b - ridge.a) * t) * profile * profile;
        // Max envelopes are order independent and cannot inflate as spurs overlap.
        elevation = Math.max(elevation, h);
      }
      const mask = smoothStep(0, 12, elevation);
      const broad = noise(x, z, 0x1459, 36);
      elevation += broad * 0.8 * mask;
      // Three isolated, tilted meadows; their masks never follow elevation contours.
      for (const bench of benches) {
        const dx = x - bench.x;
        const dz = z - bench.z;
        const u = dx * Math.cos(bench.angle) + dz * Math.sin(bench.angle);
        const v = dz * Math.cos(bench.angle) - dx * Math.sin(bench.angle);
        const radius = Math.hypot(u / bench.rx, v / bench.rz)
          + noise(x, z, 0x831a, 15) * 0.16;
        const weight = 1 - smoothStep(0.62, 1.12, radius);
        const plane = bench.y + u * bench.tilt + v * 0.055;
        elevation += (plane - elevation) * weight;
      }
      return Math.max(0, elevation) * smoothStep(0, 14, edge);
    },
  };
}

/** Nested Cartesian samples: the coarse LOD uses exactly the same surface. */
export function buildAlpineRangeGeometry(field: AlpineRangeField, spacing: number): THREE.BufferGeometry {
  if (!Number.isFinite(spacing) || spacing <= 0) throw new Error('Invalid alpine grid spacing');
  const { x0, x1, z0, z1 } = field.bounds;
  const nx = Math.ceil((x1 - x0) / spacing);
  const nz = Math.ceil((z1 - z0) / spacing);
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const colors = new Float32Array(positions.length);
  const grass = new THREE.Color(0x74ae48);
  const rock = new THREE.Color(0xa5b7c5);
  const warmRock = new THREE.Color(0xb4aa9b);
  const snow = new THREE.Color(0xe2ebef);
  const haze = new THREE.Color(0xd4e1e6);
  const tint = new THREE.Color();
  for (let iz = 0; iz <= nz; iz += 1) {
    for (let ix = 0; ix <= nx; ix += 1) {
      const x = Math.min(x1, x0 + ix * spacing);
      const z = Math.min(z1, z0 + iz * spacing);
      const y = field.heightAt(x, z);
      const index = (iz * (nx + 1) + ix) * 3;
      positions.set([x, y, z], index);
      // Fixed derivative radius keeps material bands consistent across LODs.
      const dx = (field.heightAt(x + 0.8, z) - field.heightAt(x - 0.8, z)) / 1.6;
      const dz = (field.heightAt(x, z + 0.8) - field.heightAt(x, z - 0.8)) / 1.6;
      const up = 1 / Math.sqrt(1 + dx * dx + dz * dz);
      const variation = noise(x, z, 0xab23, 17);
      const rockWeight = 1 - smoothStep(0.80, 0.96, up);
      tint.copy(grass).lerp(rock, rockWeight);
      tint.multiplyScalar(0.98 + variation * 0.06);
      tint.lerp(haze, (1 - smoothStep(-290, -160, z)) * 0.32);
      // Restrict the new palette to elevated rock: the world-ground seam uses
      // the exact original grass/noise/haze formula on the entire perimeter.
      const exposed = rockWeight * smoothStep(2, 14, y);
      const warmth = smoothStep(-0.45, 0.6, noise(x, z, 0x6a91, 95));
      tint.lerp(warmRock, exposed * warmth * 0.52);
      const snowWeight = smoothStep(78, 94, y + variation * 9)
        * smoothStep(0.32, 0.64, up) * smoothStep(-0.28, 0.12, noise(x, z, 0x93ad, 9));
      tint.lerp(snow, snowWeight * 0.85);
      colors.set([tint.r, tint.g, tint.b], index);
    }
  }
  const indices: number[] = [];
  for (let iz = 0; iz < nz; iz += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const a = iz * (nx + 1) + ix;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
