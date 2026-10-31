// 星港城生活道具（从 urbanLife.ts 按岛拆分；位置手写唯一事实源）。
// 坐标为最终世界坐标（历史「渲染时 x−70/z+6」草案映射已归一化写回，
// 与 urbanLifeOldport、间距审计共用同一坐标系）。
import type { UrbanLifeSpec } from './urbanLife';

export const URBAN_LIFE_STARPORT: readonly UrbanLifeSpec[] = [
  { districtId: 'island-starport', kind: 'stall', x: -296, z: 187, tint: 0x536fba },
  { districtId: 'island-starport', kind: 'stall', x: -288, z: 187, tint: 0x7c65a5 },
  { districtId: 'island-starport', kind: 'stall', x: -280, z: 187, tint: 0x398d9c },
  { districtId: 'island-starport', kind: 'stall', x: -272, z: 187, tint: 0xc37b5c },
  { districtId: 'island-starport', kind: 'parasol', x: -306, z: 196, tint: 0x728ac6 },
  { districtId: 'island-starport', kind: 'parasol', x: -271, z: 196, tint: 0x65a6a5 },
  { districtId: 'island-starport', kind: 'crate', x: -292, z: 194 }, { districtId: 'island-starport', kind: 'crate', x: -277, z: 194 },
  { districtId: 'island-starport', kind: 'bench', x: -285, z: 199 },
  { districtId: 'island-starport', kind: 'planter', x: -302, z: 188 }, { districtId: 'island-starport', kind: 'planter', x: -267, z: 188 },
  { districtId: 'island-starport', kind: 'park', x: -285, z: 352 },
  // 馆带街廓空档市集列：幻灭纪念堂（−356.5,346）与怪谈藏书楼（−309,346）之间
  // 的留白沿 z=345 成排，8u 排距；西端原位（−355）压在纪念堂足印内，东移让位。
  { districtId: 'island-starport', kind: 'stall', x: -347, z: 345, tint: 0x9a658e },
  { districtId: 'island-starport', kind: 'stall', x: -339, z: 345, tint: 0x4d9b91 },
  { districtId: 'island-starport', kind: 'stall', x: -331, z: 345, tint: 0x567db0 },
  { districtId: 'island-starport', kind: 'stall', x: -229, z: 345, tint: 0xcc8453 },
  { districtId: 'island-starport', kind: 'stall', x: -221, z: 345, tint: 0x5a82b5 },
  { districtId: 'island-starport', kind: 'stall', x: -213, z: 345, tint: 0x728e59 },
  { districtId: 'island-starport', kind: 'parasol', x: -350, z: 358, tint: 0x758ec6 },
  { districtId: 'island-starport', kind: 'parasol', x: -220, z: 358, tint: 0xb187ae },
  { districtId: 'island-starport', kind: 'bench', x: -351, z: 362, rotY: Math.PI },
  { districtId: 'island-starport', kind: 'bench', x: -219, z: 362, rotY: Math.PI },
  { districtId: 'island-starport', kind: 'lamp', x: -369, z: 180 }, { districtId: 'island-starport', kind: 'lamp', x: -201, z: 180 },
  { districtId: 'island-starport', kind: 'lamp', x: -369, z: 199 }, { districtId: 'island-starport', kind: 'lamp', x: -201, z: 207 },
  { districtId: 'island-starport', kind: 'lamp', x: -369, z: 332 }, { districtId: 'island-starport', kind: 'lamp', x: -201, z: 332 },
  { districtId: 'island-starport', kind: 'lamp', x: -369, z: 378 }, { districtId: 'island-starport', kind: 'lamp', x: -201, z: 372 },
  { districtId: 'island-starport', kind: 'lamp', x: -291, z: 166 }, { districtId: 'island-starport', kind: 'lamp', x: -279, z: 166 },
  { districtId: 'island-starport', kind: 'lamp', x: -291, z: 374 }, { districtId: 'island-starport', kind: 'lamp', x: -279, z: 374 },
  { districtId: 'island-starport', kind: 'tree', x: -365, z: 183 }, { districtId: 'island-starport', kind: 'tree', x: -205, z: 183 },
  // 南港带行线（z=327.5）北缘行道树：后退到前坪带 z=331.5，避开南港西里
  // 二号楼（−361,327.5）临街面；东端同款树在（−206,329）保持对称。
  { districtId: 'island-starport', kind: 'tree', x: -364, z: 331.5 }, { districtId: 'island-starport', kind: 'tree', x: -206, z: 329 },
  { districtId: 'island-starport', kind: 'tree', x: -314, z: 375 }, { districtId: 'island-starport', kind: 'tree', x: -294, z: 375 },
  { districtId: 'island-starport', kind: 'tree', x: -274, z: 375 }, { districtId: 'island-starport', kind: 'tree', x: -254, z: 375 },
  { districtId: 'island-starport', kind: 'kiosk', x: -275, z: 177 }, { districtId: 'island-starport', kind: 'kiosk', x: -302, z: 332 },
  { districtId: 'island-starport', kind: 'bench', x: -304, z: 373, rotY: Math.PI }, { districtId: 'island-starport', kind: 'bench', x: -269, z: 373, rotY: Math.PI },
  // ── wave 3 城市重造填充（docs/year-towns-urban-redesign.md §4）─────────────
  // 星港大道路灯（x -324.5/-315.5 交错成列）。
  { districtId: 'island-starport', kind: 'lamp', x: -324.5, z: 156 }, { districtId: 'island-starport', kind: 'lamp', x: -315.5, z: 201 },
  { districtId: 'island-starport', kind: 'lamp', x: -324.5, z: 246 }, { districtId: 'island-starport', kind: 'lamp', x: -315.5, z: 280 },
  { districtId: 'island-starport', kind: 'lamp', x: -324.5, z: 318 }, { districtId: 'island-starport', kind: 'lamp', x: -315.5, z: 344 },
  { districtId: 'island-starport', kind: 'lamp', x: -324.5, z: 368 },
  // 夜航街 / 南港街路灯成列。
  { districtId: 'island-starport', kind: 'lamp', x: -299.5, z: 253.4 }, { districtId: 'island-starport', kind: 'lamp', x: -256, z: 253.4 },
  { districtId: 'island-starport', kind: 'lamp', x: -217, z: 253.4 }, { districtId: 'island-starport', kind: 'lamp', x: -349, z: 260.6 },
  { districtId: 'island-starport', kind: 'lamp', x: -262, z: 260.6 },
  { districtId: 'island-starport', kind: 'lamp', x: -311, z: 303.2 }, { districtId: 'island-starport', kind: 'lamp', x: -283, z: 303.2 },
  { districtId: 'island-starport', kind: 'lamp', x: -236, z: 303.2 },
  // 市场广场 A（星港大道广场）内环摊位。
  { districtId: 'island-starport', kind: 'stall', x: -326, z: 185.5, tint: 0x4d86a8 },
  { districtId: 'island-starport', kind: 'stall', x: -314, z: 185.5, tint: 0x8a6bab },
  { districtId: 'island-starport', kind: 'stall', x: -326, z: 194.5, tint: 0x3f9d8a },
  { districtId: 'island-starport', kind: 'stall', x: -318, z: 194.5, tint: 0xc98a5a },
  { districtId: 'island-starport', kind: 'parasol', x: -320, z: 184, tint: 0x6f9fc9 },
  { districtId: 'island-starport', kind: 'planter', x: -326.5, z: 190 },
  { districtId: 'island-starport', kind: 'crate', x: -322, z: 196.5 },
  // 市场广场 B（西南广场）内环摊位。
  { districtId: 'island-starport', kind: 'stall', x: -376, z: 355.5, tint: 0x5a7db5 },
  { districtId: 'island-starport', kind: 'stall', x: -380, z: 357.5, tint: 0xb5768f },
  { districtId: 'island-starport', kind: 'parasol', x: -377, z: 360, tint: 0x86a06b },
  // 市场广场 C（东南广场）内环摊位。
  { districtId: 'island-starport', kind: 'stall', x: -263, z: 348, tint: 0x7a6fae },
  { districtId: 'island-starport', kind: 'stall', x: -251, z: 348, tint: 0x4f9d7f },
  { districtId: 'island-starport', kind: 'stall', x: -263, z: 356, tint: 0xd09a5c },
  { districtId: 'island-starport', kind: 'parasol', x: -257, z: 345.5, tint: 0xa583b5 },
  { districtId: 'island-starport', kind: 'bench', x: -251, z: 356, rotY: Math.PI },
  // 夜市街（final z=336）街谷北缘摊位列——星港的灵魂，密度最高。
  { districtId: 'island-starport', kind: 'stall', x: -363, z: 339.2, tint: 0x5376b3 },
  { districtId: 'island-starport', kind: 'stall', x: -351, z: 339.2, tint: 0x9c6a9a },
  { districtId: 'island-starport', kind: 'stall', x: -341, z: 339.2, tint: 0x46958e },
  { districtId: 'island-starport', kind: 'stall', x: -313, z: 339.2, tint: 0xc07f57 },
  { districtId: 'island-starport', kind: 'stall', x: -297, z: 339.2, tint: 0x6d86b8 },
  { districtId: 'island-starport', kind: 'stall', x: -280, z: 339.2, tint: 0x8f7050 },
  { districtId: 'island-starport', kind: 'stall', x: -263, z: 339.2, tint: 0x5a9d9a },
  { districtId: 'island-starport', kind: 'parasol', x: -357, z: 339.2, tint: 0x7d92c4 },
  { districtId: 'island-starport', kind: 'crate', x: -309, z: 339.2 },
  // 夜市街南缘摊位列（避开磁悬环线 (-285,322)→(-245,340) 斜穿段）。
  { districtId: 'island-starport', kind: 'stall', x: -350, z: 332.8, tint: 0x7d6fa8 },
  { districtId: 'island-starport', kind: 'stall', x: -328, z: 332.8, tint: 0x3e8f7a },
  { districtId: 'island-starport', kind: 'stall', x: -276, z: 332.8, tint: 0xba8756 },
  { districtId: 'island-starport', kind: 'stall', x: -231, z: 332.8, tint: 0x5f87bb },
  { districtId: 'island-starport', kind: 'parasol', x: -320, z: 332.8, tint: 0x8a7fbf },
  // 西泊位后场（S6/S7）货箱组。
  { districtId: 'island-starport', kind: 'crate', x: -386, z: 243 }, { districtId: 'island-starport', kind: 'crate', x: -365, z: 240 },
  { districtId: 'island-starport', kind: 'crate', x: -358, z: 243.5 }, { districtId: 'island-starport', kind: 'crate', x: -349, z: 242.5 },
  { districtId: 'island-starport', kind: 'crate', x: -341, z: 243 }, { districtId: 'island-starport', kind: 'crate', x: -329, z: 244 },
  // 街廓角树 / 滨水树与长椅 / 夜市亭 / 南港花坛。
  { districtId: 'island-starport', kind: 'tree', x: -292, z: 370 }, { districtId: 'island-starport', kind: 'tree', x: -390, z: 270 },
  { districtId: 'island-starport', kind: 'tree', x: -246, z: 236 },
  { districtId: 'island-starport', kind: 'bench', x: -278, z: 372, rotY: 0 }, { districtId: 'island-starport', kind: 'bench', x: -259, z: 249, rotY: 0 },
  { districtId: 'island-starport', kind: 'kiosk', x: -244, z: 334 },
  { districtId: 'island-starport', kind: 'planter', x: -370, z: 318 },
];
