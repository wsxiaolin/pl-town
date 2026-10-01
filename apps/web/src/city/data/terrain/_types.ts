// 地形要素（山河湖海等）的类型规划。目前只有类型与空配置，没有渲染实现；
// 这里的字段是给未来地形工具预留的稳定契约：新增地形先写配置文件，
// 渲染器随后按 renderHint 接线，导航系统按 navigation* 字段同步避让。
//
// 设计约束（来自 AGENTS.md 与现有代码）：
// - 任何贴地网格不得与其他表面共用相同 y，须使用 `rendering/layers.ts`
//   的 SURFACE_Y 体系并保留 ≥0.004 的高度差，避免远镜头 z-fighting。
// - 现有先例：西侧海岸（WEST_BEACH，cityConfig.ts）与西海滩浪面
//   （rendering/westBeach.ts）——地形实现应沿用"配置在 data、渲染在
//   rendering、导航避让在 navigation"的分层。
// - 大面积地形（湖面、海面）优先复用 animatedWater 的水体材质与帧循环。

export type TerrainKind =
  | 'mountain'   // 山脉：静态体块，含海拔与坡面纹理
  | 'river'      // 河流：沿 path 的带状水面，需水体动画
  | 'lake'       // 湖泊：封闭水面
  | 'sea'        // 海：城市边缘的大面积水面（先例：西海滩）
  | 'forest'     // 林地：装饰树聚集区，含密度参数
  | 'cliff'      // 崖壁：阻断通行的竖直面
  | 'island';    // 离岛：水域中的可登陆地块

export interface TerrainFeatureConfig {
  /** 稳定 ID；地形一旦上线即被导航/存档引用，发布后不可改名。 */
  id: string;
  kind: TerrainKind;
  /** 可选中文名（地图 / 调试面板显示）。 */
  label?: string;

  // ── 位置与形状 ─────────────────────────────────
  /** 锚点：点状地形（山、湖心）用中心；带状地形（河）用起点。 */
  x: number;
  z: number;
  /** 简单包络：宽 / 深（世界单位）；山可再给 height（海拔）。 */
  width?: number;
  depth?: number;
  height?: number;
  /** 带状/线状地形的路径点（河流、海岸线、山脊线），[x, z] 序列。 */
  path?: Array<[number, number]>;

  // ── 渲染提示（实现时消费；先配置后渲染）──────────
  renderHint?: {
    /** 程序化纹理 key（proceduralTextureLibrary）或自定义 key。 */
    textures?: string[];
    /** 主色（hex number），与 PALETTE 体系一致。 */
    color?: number;
    /** 水体类地形是否启用流动动画（animatedWater）。 */
    animated?: boolean;
    castShadow?: boolean;
  };

  // ── 导航影响 ───────────────────────────────────
  /** true = NPC 与玩家寻路须绕行（山体、深水）。 */
  navigationBlocking?: boolean;
  /** 可通行但需保持的间隙（如岸线缓冲）。 */
  navigationClearance?: number;
}
