// 外城生活设施。所有位置均相对所属大城手工登记；渲染时可批量实例化。
export type UrbanLifeKind = 'tree' | 'lamp' | 'bench' | 'stall' | 'planter' | 'kiosk' | 'park' | 'crate' | 'parasol';
export interface UrbanLifeSpec {
  kind: UrbanLifeKind;
  districtId: 'island-oldport' | 'island-starport';
  x: number;
  z: number;
  rotY?: number;
  tint?: number;
}

export const YEAR_TOWN_URBAN_LIFE: readonly UrbanLifeSpec[] = [
  // 旧港北市：蔬菜、鱼、面包、花与手工艺品，通道留给行人。
  { districtId: 'island-oldport', kind: 'stall', x: 10, z: 181, rotY: 0, tint: 0xc95e48 },
  { districtId: 'island-oldport', kind: 'stall', x: 18, z: 181, rotY: 0, tint: 0xe2b54f },
  { districtId: 'island-oldport', kind: 'stall', x: 26, z: 181, rotY: 0, tint: 0x648c67 },
  { districtId: 'island-oldport', kind: 'stall', x: 34, z: 181, rotY: 0, tint: 0x5f86ad },
  { districtId: 'island-oldport', kind: 'parasol', x: 7, z: 189, tint: 0xd99462 },
  { districtId: 'island-oldport', kind: 'parasol', x: 32, z: 189, tint: 0xe2c878 },
  { districtId: 'island-oldport', kind: 'crate', x: 12, z: 187 },
  { districtId: 'island-oldport', kind: 'crate', x: 27, z: 187 },
  { districtId: 'island-oldport', kind: 'bench', x: 19, z: 192 },
  { districtId: 'island-oldport', kind: 'planter', x: 3, z: 182 },
  { districtId: 'island-oldport', kind: 'planter', x: 38, z: 182 },
  // 旧港南市与海滨公园。
  { districtId: 'island-oldport', kind: 'park', x: 20, z: 349 },
  { districtId: 'island-oldport', kind: 'stall', x: -49, z: 344, tint: 0xb75643 },
  { districtId: 'island-oldport', kind: 'stall', x: -42, z: 344, tint: 0xd4a844 },
  { districtId: 'island-oldport', kind: 'stall', x: -35, z: 344, tint: 0x568c86 },
  { districtId: 'island-oldport', kind: 'stall', x: 70, z: 344, tint: 0xb66882 },
  { districtId: 'island-oldport', kind: 'stall', x: 77, z: 344, tint: 0x5888a8 },
  { districtId: 'island-oldport', kind: 'stall', x: 84, z: 344, tint: 0xc98742 },
  { districtId: 'island-oldport', kind: 'parasol', x: -47, z: 355, tint: 0xe0b463 },
  { districtId: 'island-oldport', kind: 'parasol', x: 76, z: 355, tint: 0x749bb0 },
  { districtId: 'island-oldport', kind: 'bench', x: -48, z: 358, rotY: Math.PI },
  { districtId: 'island-oldport', kind: 'bench', x: 80, z: 358, rotY: Math.PI },
  // 旧港街道设施：沿道路与建筑之间的步行带成列。
  { districtId: 'island-oldport', kind: 'lamp', x: -62, z: 174 }, { districtId: 'island-oldport', kind: 'lamp', x: 98, z: 174 },
  { districtId: 'island-oldport', kind: 'lamp', x: -62, z: 201 }, { districtId: 'island-oldport', kind: 'lamp', x: 98, z: 201 },
  { districtId: 'island-oldport', kind: 'lamp', x: -62, z: 334 }, { districtId: 'island-oldport', kind: 'lamp', x: 98, z: 334 },
  { districtId: 'island-oldport', kind: 'lamp', x: -62, z: 374 }, { districtId: 'island-oldport', kind: 'lamp', x: 98, z: 374 },
  { districtId: 'island-oldport', kind: 'lamp', x: 14, z: 160 }, { districtId: 'island-oldport', kind: 'lamp', x: 26, z: 160 },
  { districtId: 'island-oldport', kind: 'lamp', x: 14, z: 378 }, { districtId: 'island-oldport', kind: 'lamp', x: 26, z: 378 },
  { districtId: 'island-oldport', kind: 'tree', x: -59, z: 176 }, { districtId: 'island-oldport', kind: 'tree', x: 89, z: 176 },
  { districtId: 'island-oldport', kind: 'tree', x: -58, z: 333 }, { districtId: 'island-oldport', kind: 'tree', x: 91, z: 333 },
  { districtId: 'island-oldport', kind: 'tree', x: -9, z: 376 }, { districtId: 'island-oldport', kind: 'tree', x: 9, z: 376 },
  { districtId: 'island-oldport', kind: 'tree', x: 31, z: 376 }, { districtId: 'island-oldport', kind: 'tree', x: 51, z: 376 },
  { districtId: 'island-oldport', kind: 'kiosk', x: 30, z: 171 }, { districtId: 'island-oldport', kind: 'kiosk', x: -18, z: 334 },
  { districtId: 'island-oldport', kind: 'bench', x: 6, z: 374, rotY: Math.PI }, { districtId: 'island-oldport', kind: 'bench', x: 36, z: 374, rotY: Math.PI },

  // 星港天幕市集：科技产品、植物、餐饮和夜间社交。
  { districtId: 'island-starport', kind: 'stall', x: -226, z: 181, tint: 0x536fba },
  { districtId: 'island-starport', kind: 'stall', x: -218, z: 181, tint: 0x7c65a5 },
  { districtId: 'island-starport', kind: 'stall', x: -210, z: 181, tint: 0x398d9c },
  { districtId: 'island-starport', kind: 'stall', x: -202, z: 181, tint: 0xc37b5c },
  { districtId: 'island-starport', kind: 'parasol', x: -229, z: 190, tint: 0x728ac6 },
  { districtId: 'island-starport', kind: 'parasol', x: -201, z: 190, tint: 0x65a6a5 },
  { districtId: 'island-starport', kind: 'crate', x: -222, z: 188 }, { districtId: 'island-starport', kind: 'crate', x: -207, z: 188 },
  { districtId: 'island-starport', kind: 'bench', x: -215, z: 193 },
  { districtId: 'island-starport', kind: 'planter', x: -232, z: 182 }, { districtId: 'island-starport', kind: 'planter', x: -197, z: 182 },
  { districtId: 'island-starport', kind: 'park', x: -215, z: 346 },
  { districtId: 'island-starport', kind: 'stall', x: -285, z: 339, tint: 0x567db0 },
  { districtId: 'island-starport', kind: 'stall', x: -277, z: 339, tint: 0x9a658e },
  { districtId: 'island-starport', kind: 'stall', x: -269, z: 339, tint: 0x4d9b91 },
  { districtId: 'island-starport', kind: 'stall', x: -159, z: 339, tint: 0xcc8453 },
  { districtId: 'island-starport', kind: 'stall', x: -151, z: 339, tint: 0x5a82b5 },
  { districtId: 'island-starport', kind: 'stall', x: -143, z: 339, tint: 0x728e59 },
  { districtId: 'island-starport', kind: 'parasol', x: -280, z: 352, tint: 0x758ec6 },
  { districtId: 'island-starport', kind: 'parasol', x: -150, z: 352, tint: 0xb187ae },
  { districtId: 'island-starport', kind: 'bench', x: -281, z: 356, rotY: Math.PI },
  { districtId: 'island-starport', kind: 'bench', x: -149, z: 356, rotY: Math.PI },
  { districtId: 'island-starport', kind: 'lamp', x: -299, z: 174 }, { districtId: 'island-starport', kind: 'lamp', x: -131, z: 174 },
  { districtId: 'island-starport', kind: 'lamp', x: -299, z: 201 }, { districtId: 'island-starport', kind: 'lamp', x: -131, z: 201 },
  { districtId: 'island-starport', kind: 'lamp', x: -299, z: 326 }, { districtId: 'island-starport', kind: 'lamp', x: -131, z: 326 },
  { districtId: 'island-starport', kind: 'lamp', x: -299, z: 366 }, { districtId: 'island-starport', kind: 'lamp', x: -131, z: 366 },
  { districtId: 'island-starport', kind: 'lamp', x: -221, z: 160 }, { districtId: 'island-starport', kind: 'lamp', x: -209, z: 160 },
  { districtId: 'island-starport', kind: 'lamp', x: -221, z: 368 }, { districtId: 'island-starport', kind: 'lamp', x: -209, z: 368 },
  { districtId: 'island-starport', kind: 'tree', x: -295, z: 177 }, { districtId: 'island-starport', kind: 'tree', x: -135, z: 177 },
  { districtId: 'island-starport', kind: 'tree', x: -294, z: 323 }, { districtId: 'island-starport', kind: 'tree', x: -136, z: 323 },
  { districtId: 'island-starport', kind: 'tree', x: -244, z: 369 }, { districtId: 'island-starport', kind: 'tree', x: -224, z: 369 },
  { districtId: 'island-starport', kind: 'tree', x: -204, z: 369 }, { districtId: 'island-starport', kind: 'tree', x: -184, z: 369 },
  { districtId: 'island-starport', kind: 'kiosk', x: -205, z: 171 }, { districtId: 'island-starport', kind: 'kiosk', x: -232, z: 326 },
  { districtId: 'island-starport', kind: 'bench', x: -229, z: 367, rotY: Math.PI }, { districtId: 'island-starport', kind: 'bench', x: -199, z: 367, rotY: Math.PI },
];
