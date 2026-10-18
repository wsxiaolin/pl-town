// Material families shared by resident houses. A family fixes the wall/roof
// textures and accent colours so an entire neighbourhood block reads as one
// "family" while the archetype (massing) and micro-variant keep lots distinct.
export type ResidenceFamily = {
  name: string;
  wall: number;
  wallTex: string;
  /** Secondary wall texture for upper storeys, dormers and outbuildings. */
  upperTex: string;
  roof: number;
  roofTex: string;
  trim: number;
  accent: number;
  plinth: number;
};

export const RESIDENCE_FAMILIES: readonly ResidenceFamily[] = [
  {
    name: '米白水泥',
    wall: 0xf2eee4,
    wallTex: 'residence_plaster',
    upperTex: 'residence_plaster',
    roof: 0x9b5a48,
    roofTex: 'rooftile',
    trim: 0xf5f3ed,
    accent: 0x7a5236,
    plinth: 0xe0dfdc,
  },
  {
    name: '暖砖烟囱',
    wall: 0xd8b79a,
    wallTex: 'residence_redbrick',
    upperTex: 'residence_panel',
    roof: 0x59656f,
    roofTex: 'residence_shingle',
    trim: 0xf0e6da,
    accent: 0x6a3f2c,
    plinth: 0xcfc4b6,
  },
  {
    name: '海蓝护墙板',
    wall: 0xbcd6da,
    wallTex: 'residence_panel',
    upperTex: 'residence_panel',
    roof: 0x557d91,
    roofTex: 'residence_tile',
    trim: 0xf3f4f2,
    accent: 0x35566a,
    plinth: 0xdedad2,
  },
  {
    name: '浅灰石屋',
    wall: 0xd8d5cb,
    wallTex: 'stone',
    upperTex: 'residence_plaster',
    roof: 0x3d4651,
    roofTex: 'residence_shingle',
    trim: 0xf1efe8,
    accent: 0x4b4f57,
    plinth: 0xcac6bc,
  },
  {
    name: '木纹奶咖',
    wall: 0xe5d1b8,
    wallTex: 'residence_wood',
    upperTex: 'residence_wood',
    roof: 0xa5493c,
    roofTex: 'rooftile',
    trim: 0xf6efe2,
    accent: 0x6d4a2f,
    plinth: 0xd8cbb6,
  },
  {
    name: '苔绿灰泥',
    wall: 0xd9eadc,
    wallTex: 'residence_mossplaster',
    upperTex: 'residence_plaster',
    roof: 0x6c9279,
    roofTex: 'residence_tile',
    trim: 0xf0f4ee,
    accent: 0x4b6a53,
    plinth: 0xd2d6cd,
  },
  {
    name: '青灰砖楼',
    wall: 0xbfc3c6,
    wallTex: 'residence_brick_pale',
    upperTex: 'residence_brick_pale',
    roof: 0x3a3f45,
    roofTex: 'roof_charcoal',
    trim: 0xeceef0,
    accent: 0x3f4650,
    plinth: 0xb8bcc0,
  },
  {
    name: '象牙石居',
    wall: 0xece3d2,
    wallTex: 'residence_stone_gray',
    upperTex: 'residence_plaster',
    roof: 0x59806f,
    roofTex: 'roof_copper',
    trim: 0xf7f2e6,
    accent: 0x6b5a3c,
    plinth: 0xd9d2c4,
  },
];

export const RESIDENCE_FAMILY_COUNT = RESIDENCE_FAMILIES.length;

export function residenceFamily(index: number): ResidenceFamily {
  const family = RESIDENCE_FAMILIES[index];
  return family ?? RESIDENCE_FAMILIES[0]!;
}
