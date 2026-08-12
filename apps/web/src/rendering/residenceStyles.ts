import * as THREE from 'three';

type Part = (
  group: THREE.Group | null,
  geometry: THREE.BufferGeometry,
  material: Record<string, unknown>,
  position?: readonly [number, number, number],
  castShadow?: boolean,
) => THREE.Mesh;

type ResidenceStyleOptions = {
  x: number;
  z: number;
  index: number;
  lotType: number;
  isNight: boolean;
  part: Part;
};

const STYLE_NAMES = [
  '白墙坡顶', '暖砖烟囱', '青瓦小院', '木构檐廊', '海蓝露台',
  '浅石塔楼', '玻璃现代', '红瓦花园', '双层公寓', '斜顶工作室',
] as const;

function seededInt(x: number, z: number, salt: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return Math.abs(Math.floor((value - Math.floor(value)) * 1_000_000));
}

/** Adjacent lots share a two-style family while retaining deterministic variation. */
export function residenceStyleFor(x: number, z: number, index: number): number {
  const districtX = Math.floor((x + 42) / 12);
  const districtZ = Math.floor((z + 42) / 12);
  const family = seededInt(districtX, districtZ, 17) % 5;
  const alternate = seededInt(x, z, index) % 5 === 0 ? 1 : 0;
  return family * 2 + alternate;
}

export function createResidenceModel(options: ResidenceStyleOptions): { group: THREE.Group; styleId: number; styleName: string } {
  const { x, z, index, lotType, isNight, part } = options;
  const group = new THREE.Group();
  const styleId = residenceStyleFor(x, z, index);
  const width = lotType === 2 ? 1.25 : 1.6;
  const depth = lotType === 1 ? 1.15 : 1.5;
  const height = 0.92 + (index % 4) * 0.18 + (styleId === 8 ? 0.42 : 0);
  const families = [
    { wall: 0xf2eee4, wallTex: 'wall', roof: 0x9b5a48, roofTex: 'rooftile' },
    { wall: 0xd6c2a0, wallTex: 'brick', roof: 0x59656f, roofTex: 'metal' },
    { wall: 0xdce8e9, wallTex: 'suburb', roof: 0x557d91, roofTex: 'metal' },
    { wall: 0xd8d5cb, wallTex: 'stone', roof: 0x3d4651, roofTex: 'metal' },
    { wall: 0xe5d1b8, wallTex: 'brick', roof: 0xa5493c, roofTex: 'rooftile' },
  ] as const;
  const palette = families[Math.floor(styleId / 2)]!;
  const mesh = (geometry: THREE.BufferGeometry, material: Record<string, unknown>, position: readonly [number, number, number], cast = true) =>
    part(group, geometry, material, position, cast);

  mesh(new THREE.BoxGeometry(width + 0.38, 0.12, depth + 0.38), { color: 0xd3c9b8, roughness: 0.9, tex: 'stone', rx: 1, ry: 1 }, [0, 0.06, 0]);
  mesh(new THREE.BoxGeometry(width, height, depth), { color: palette.wall, roughness: 0.68, tex: palette.wallTex, rx: 1, ry: 1 }, [0, 0.12 + height / 2, 0]);

  const roofY = 0.12 + height;
  if ([0, 1, 7, 9].includes(styleId)) {
    const roof = mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.68, 0.55, 4), { color: palette.roof, roughness: 0.62, tex: palette.roofTex, rx: 2, ry: 1 }, [0, roofY + 0.275, 0]);
    roof.rotation.y = Math.PI / 4;
  } else if ([2, 3].includes(styleId)) {
    const lower = mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 0.34, 4), { color: palette.roof, roughness: 0.7, tex: 'pagoda_tile', rx: 2, ry: 1 }, [0, roofY + 0.17, 0]);
    lower.rotation.y = Math.PI / 4;
    if (styleId === 3) {
      const upper = mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.47, 0.25, 4), { color: 0x425c52, roughness: 0.72, tex: 'pagoda_tile', rx: 2, ry: 1 }, [0, roofY + 0.39, 0]);
      upper.rotation.y = Math.PI / 4;
    }
  } else {
    mesh(new THREE.BoxGeometry(width + 0.18, 0.11, depth + 0.18), { color: palette.roof, roughness: 0.66, tex: palette.roofTex, rx: 2, ry: 2 }, [0, roofY + 0.055, 0]);
  }

  const glass = { color: 0xa9cae5, emissive: 0x7ea8d5, emissiveIntensity: isNight ? 0.16 : 0.025, roughness: 0.18, tex: 'glass', rx: 1, ry: 1 };
  const windowCount = styleId === 8 ? 4 : 2;
  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const wx = -width / 2 + 0.34 + (windowIndex % 2) * Math.max(0.62, width - 0.68);
    const wy = 0.46 + Math.floor(windowIndex / 2) * 0.43;
    mesh(new THREE.BoxGeometry(0.25, 0.19, 0.035), glass, [wx, wy, depth / 2 + 0.02], false);
  }
  mesh(new THREE.BoxGeometry(0.27, 0.5, 0.045), { color: styleId === 4 ? 0xf1f0e8 : 0x76513a, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, 0.37, depth / 2 + 0.025], false);

  if (styleId === 1) mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), { color: 0x79564a, roughness: 0.82, tex: 'brick', rx: 1, ry: 1 }, [width * 0.3, roofY + 0.28, 0], true);
  if (styleId === 3) {
    [-0.48, 0.48].forEach((px) => mesh(new THREE.BoxGeometry(0.07, 0.68, 0.07), { color: 0x74533c, roughness: 0.8, tex: 'wood', rx: 1, ry: 1 }, [px, 0.46, depth / 2 + 0.24]));
    mesh(new THREE.BoxGeometry(width * 0.82, 0.08, 0.46), { color: 0x8a6041, roughness: 0.82, tex: 'wood', rx: 2, ry: 1 }, [0, 0.82, depth / 2 + 0.22]);
  }
  if (styleId === 4) mesh(new THREE.BoxGeometry(width * 0.72, 0.05, 0.48), { color: 0xe7e1d4, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, roofY + 0.12, 0]);
  if (styleId === 5) mesh(new THREE.CylinderGeometry(0.3, 0.36, height + 0.18, 12), { color: 0xc9c4b8, roughness: 0.88, tex: 'stone', rx: 1, ry: 2 }, [width * 0.38, 0.12 + height / 2, -depth * 0.25]);
  if (styleId === 6) mesh(new THREE.BoxGeometry(width * 0.72, 0.5, 0.04), glass, [0, 0.58, depth / 2 + 0.025], false);
  if (styleId === 7) {
    mesh(new THREE.BoxGeometry(width * 0.82, 0.05, 0.42), { color: 0xefe8d8, roughness: 0.9, tex: 'fabric', rx: 2, ry: 1 }, [0, 0.77, depth / 2 + 0.2]);
    [-0.48, 0.48].forEach((px) => mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.7, 8), { color: 0x6f523c, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 }, [px, 0.39, depth / 2 + 0.2]));
  }
  if (styleId === 8) mesh(new THREE.BoxGeometry(width + 0.1, 0.08, 0.28), { color: 0x59656f, roughness: 0.55, tex: 'metal', rx: 2, ry: 1 }, [0, 0.9, depth / 2 + 0.16]);
  if (styleId === 9) {
    const studioWindow = mesh(new THREE.BoxGeometry(width * 0.55, 0.035, 0.48), glass, [0, roofY + 0.22, 0], false);
    studioWindow.rotation.x = -0.55;
  }

  group.userData.residenceStyleId = styleId;
  group.userData.residenceStyleName = STYLE_NAMES[styleId];
  return { group, styleId, styleName: STYLE_NAMES[styleId]! };
}
