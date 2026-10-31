// 旧港城生活道具（从 urbanLife.ts 按岛拆分；位置手写唯一事实源）。
//
// wave3 扩编口径（红队规则）：摊位/遮阳篷/货箱只进四处市集广场内圈
// ((20,240)/(20,184)/(−44,354)/(78,354) 的 r−2 内环) 与鱼市街/中市街沿街；
// 路灯沿港口大道（x=14/26 既有灯列延续）、灯市街（z=334 灯列）、南市街
// 南缘（z≈371 灯列）成列；树补街廓四角与院心；长椅补滨海步道与广场缘。
// 全部道具距任何年份建筑（含纪念设施）≥3.4u、距车站月台 ≥7.5u。
import type { UrbanLifeSpec } from './urbanLife';

export const URBAN_LIFE_OLDPORT: readonly UrbanLifeSpec[] = [
  { districtId: 'island-oldport', kind: 'stall', x: 10, z: 221, rotY: 0, tint: 0xc95e48 },
  { districtId: 'island-oldport', kind: 'stall', x: 18, z: 221, rotY: 0, tint: 0xe2b54f },
  { districtId: 'island-oldport', kind: 'stall', x: 26, z: 221, rotY: 0, tint: 0x648c67 },
  { districtId: 'island-oldport', kind: 'stall', x: 34, z: 221, rotY: 0, tint: 0x5f86ad },
  { districtId: 'island-oldport', kind: 'parasol', x: 14, z: 181, tint: 0xd99462 },
  { districtId: 'island-oldport', kind: 'parasol', x: 26, z: 181, tint: 0xe2c878 },
  { districtId: 'island-oldport', kind: 'crate', x: 15, z: 187 },
  { districtId: 'island-oldport', kind: 'crate', x: 25, z: 187 },
  { districtId: 'island-oldport', kind: 'bench', x: 19, z: 232 },
  { districtId: 'island-oldport', kind: 'planter', x: 3, z: 222 },
  { districtId: 'island-oldport', kind: 'planter', x: 38, z: 222 },
  { districtId: 'island-oldport', kind: 'park', x: 20, z: 351 },
  { districtId: 'island-oldport', kind: 'stall', x: -49, z: 346, tint: 0xb75643 },
  { districtId: 'island-oldport', kind: 'stall', x: -42, z: 346, tint: 0xd4a844 },
  { districtId: 'island-oldport', kind: 'stall', x: -35, z: 346, tint: 0x568c86 },
  { districtId: 'island-oldport', kind: 'stall', x: 70, z: 349, tint: 0xb66882 },
  { districtId: 'island-oldport', kind: 'stall', x: 77, z: 349, tint: 0x5888a8 },
  { districtId: 'island-oldport', kind: 'stall', x: 84, z: 349, tint: 0xc98742 },
  { districtId: 'island-oldport', kind: 'parasol', x: -47, z: 357, tint: 0xe0b463 },
  { districtId: 'island-oldport', kind: 'parasol', x: 76, z: 357, tint: 0x749bb0 },
  { districtId: 'island-oldport', kind: 'bench', x: -48, z: 360, rotY: Math.PI },
  { districtId: 'island-oldport', kind: 'bench', x: 80, z: 360, rotY: Math.PI },
  { districtId: 'island-oldport', kind: 'lamp', x: -62, z: 214 }, { districtId: 'island-oldport', kind: 'lamp', x: 98, z: 214 },
  { districtId: 'island-oldport', kind: 'lamp', x: -62, z: 241 }, { districtId: 'island-oldport', kind: 'lamp', x: 98, z: 241 },
  { districtId: 'island-oldport', kind: 'lamp', x: -62, z: 336 }, { districtId: 'island-oldport', kind: 'lamp', x: 98, z: 336 },
  { districtId: 'island-oldport', kind: 'lamp', x: -62, z: 371 }, { districtId: 'island-oldport', kind: 'lamp', x: 98, z: 374 },
  { districtId: 'island-oldport', kind: 'lamp', x: 14, z: 200 }, { districtId: 'island-oldport', kind: 'lamp', x: 26, z: 200 },
  { districtId: 'island-oldport', kind: 'lamp', x: 14, z: 380 }, { districtId: 'island-oldport', kind: 'lamp', x: 26, z: 380 },
  { districtId: 'island-oldport', kind: 'tree', x: -59, z: 216 }, { districtId: 'island-oldport', kind: 'tree', x: 89, z: 216 },
  { districtId: 'island-oldport', kind: 'tree', x: -58, z: 335 }, { districtId: 'island-oldport', kind: 'tree', x: 91, z: 335 },
  { districtId: 'island-oldport', kind: 'tree', x: -9, z: 378 }, { districtId: 'island-oldport', kind: 'tree', x: 9, z: 378 },
  { districtId: 'island-oldport', kind: 'tree', x: 31, z: 378 }, { districtId: 'island-oldport', kind: 'tree', x: 51, z: 378 },
  { districtId: 'island-oldport', kind: 'kiosk', x: 30, z: 211 }, { districtId: 'island-oldport', kind: 'kiosk', x: -18, z: 336 },
  { districtId: 'island-oldport', kind: 'bench', x: 6, z: 376, rotY: Math.PI }, { districtId: 'island-oldport', kind: 'bench', x: 33, z: 371, rotY: Math.PI },

  // ── wave3 扩编（+60 件）─────────────────────────────────────────────────
  // 北站前市集 (20,184) r8 内环：南/东弧补摊位货箱（北弧既有）。
  { districtId: 'island-oldport', kind: 'stall', x: 13, z: 190, tint: 0xa8623f },
  { districtId: 'island-oldport', kind: 'stall', x: 27, z: 190, tint: 0x5f86ad },
  { districtId: 'island-oldport', kind: 'crate', x: 16, z: 187 },
  // 站前市集 (20,240) r6.5 内环：整圈补齐（原本空置）。
  { districtId: 'island-oldport', kind: 'stall', x: 20, z: 235.5, tint: 0xc95e48 },
  { districtId: 'island-oldport', kind: 'stall', x: 15.5, z: 240, tint: 0xe2b54f },
  { districtId: 'island-oldport', kind: 'stall', x: 24.5, z: 240, tint: 0x648c67 },
  { districtId: 'island-oldport', kind: 'parasol', x: 20, z: 244.5, tint: 0xd99462 },
  { districtId: 'island-oldport', kind: 'crate', x: 16, z: 236 },
  // 西馆市集 (−44,354) r7 内环：东南弧补档（西侧有既有遮阳篷/长椅）。
  { districtId: 'island-oldport', kind: 'stall', x: -39, z: 354, tint: 0x568c86 },
  { districtId: 'island-oldport', kind: 'parasol', x: -41, z: 357, tint: 0xe2c878 },
  { districtId: 'island-oldport', kind: 'crate', x: -44, z: 350 },
  // 海灯市集 (78,354) r7 内环：南弧补档（北弧既有）。
  { districtId: 'island-oldport', kind: 'stall', x: 78, z: 359, tint: 0xb75643 },
  { districtId: 'island-oldport', kind: 'crate', x: 72, z: 352 },
  { districtId: 'island-oldport', kind: 'crate', x: 83, z: 352 },
  // 鱼市街沿街（z=313 南人行道，避让 (20,317) 滨水广场与 z≈334 环线）。
  { districtId: 'island-oldport', kind: 'stall', x: -15, z: 313, tint: 0xb66882 },
  { districtId: 'island-oldport', kind: 'stall', x: -1, z: 313, tint: 0x5888a8 },
  { districtId: 'island-oldport', kind: 'parasol', x: 6, z: 313, tint: 0x749bb0 },
  { districtId: 'island-oldport', kind: 'crate', x: 17, z: 313 },
  // 中市街沿街（z=258 北人行道，避让港口大道 x=20）。
  { districtId: 'island-oldport', kind: 'crate', x: -8, z: 258 },
  { districtId: 'island-oldport', kind: 'stall', x: 6, z: 258, tint: 0xc98742 },
  { districtId: 'island-oldport', kind: 'parasol', x: 13, z: 258, tint: 0xe0b463 },
  { districtId: 'island-oldport', kind: 'stall', x: 27, z: 258, tint: 0xb66882 },
  // 港口大道灯列（x=14/26 两侧交错，北段 z160 既有列向南延续）。
  { districtId: 'island-oldport', kind: 'lamp', x: 14, z: 205 },
  { districtId: 'island-oldport', kind: 'lamp', x: 26, z: 225 },
  { districtId: 'island-oldport', kind: 'lamp', x: 14, z: 250 },
  { districtId: 'island-oldport', kind: 'lamp', x: 26, z: 270 },
  { districtId: 'island-oldport', kind: 'lamp', x: 14, z: 295 },
  { districtId: 'island-oldport', kind: 'lamp', x: 26, z: 315 },
  { districtId: 'island-oldport', kind: 'lamp', x: 14, z: 340 },
  { districtId: 'island-oldport', kind: 'lamp', x: 26, z: 357 },
  // 灯市街灯列（z=334 南缘既有列 (−62)/(98) 向中段延续；x −28..−13 让位
  // (20,346)→(−32,332) 环线梁，54..64 让位 (72,332) 节点段）。
  { districtId: 'island-oldport', kind: 'lamp', x: -41, z: 334 },
  { districtId: 'island-oldport', kind: 'lamp', x: -10, z: 334 },
  { districtId: 'island-oldport', kind: 'lamp', x: -3, z: 334 },
  { districtId: 'island-oldport', kind: 'lamp', x: 11, z: 334 },
  { districtId: 'island-oldport', kind: 'lamp', x: 33, z: 334 },
  // 南市街南缘灯列（z≈371，西端 (−62,371) 既有列向东延续）。
  { districtId: 'island-oldport', kind: 'lamp', x: -44, z: 371 },
  { districtId: 'island-oldport', kind: 'lamp', x: -24, z: 370 },
  { districtId: 'island-oldport', kind: 'lamp', x: -10, z: 371 },
  { districtId: 'island-oldport', kind: 'lamp', x: 3, z: 371 },
  { districtId: 'island-oldport', kind: 'lamp', x: 31, z: 371 },
  { districtId: 'island-oldport', kind: 'lamp', x: 59, z: 371 },
  { districtId: 'island-oldport', kind: 'lamp', x: 75, z: 371 },
  // 树：灯市厢/西馆区街廓四角、东滩里东北角、南大里院心与潮声镇院心。
  { districtId: 'island-oldport', kind: 'tree', x: -62, z: 314.5 },
  { districtId: 'island-oldport', kind: 'tree', x: 13, z: 314.5 },
  { districtId: 'island-oldport', kind: 'tree', x: 98, z: 314.5 },
  { districtId: 'island-oldport', kind: 'tree', x: -62, z: 341.5 },
  { districtId: 'island-oldport', kind: 'tree', x: 27, z: 341.5 },
  { districtId: 'island-oldport', kind: 'tree', x: 58, z: 341.5 },
  { districtId: 'island-oldport', kind: 'tree', x: 98, z: 268 },
  { districtId: 'island-oldport', kind: 'tree', x: -24.5, z: 384 },
  { districtId: 'island-oldport', kind: 'tree', x: 42.5, z: 285.5 },
  // 长椅：渔港/南岸步道（x −19..−13 绕行线一带）与站前/海灯广场缘。
  { districtId: 'island-oldport', kind: 'bench', x: -15, z: 244 },
  { districtId: 'island-oldport', kind: 'bench', x: -16, z: 266 },
  { districtId: 'island-oldport', kind: 'bench', x: -15, z: 290 },
  { districtId: 'island-oldport', kind: 'bench', x: 20, z: 248 },
  { districtId: 'island-oldport', kind: 'bench', x: 72, z: 358 },
  // 亭子与花坛：站前市集服务亭、西馆区北入口报亭与花坛。
  { districtId: 'island-oldport', kind: 'kiosk', x: 10, z: 244 },
  { districtId: 'island-oldport', kind: 'kiosk', x: -53, z: 361 },
  { districtId: 'island-oldport', kind: 'planter', x: -55, z: 341 },
  { districtId: 'island-oldport', kind: 'planter', x: 15, z: 351 },
];
