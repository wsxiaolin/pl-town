// 烟花玩法共享常量。广告牌法线取主相机偏移方向（cityConfig.CAMERA_OFFSET
// = (24, 40, 24)）的归一化：正交相机 + 固定偏移下，法线 = 视线方向的
// 平面在屏幕上不产生透视畸变，拼字因此可读。相机偏移若改动，这里必须
// 同步（两处以常量互检，见 MiniCityApp 装配处的注释）。
export const CAMERA_OFFSET_BILLBOARD_NORMAL = { x: 24, y: 40, z: 24 } as const;

// 观景台烟花秀的燃放海域（世界坐标）：西海滩以西的开阔海面。
export const FIREWORK_LAUNCH_ZONE = Object.freeze({
  /** 升空点 x 范围（海面）。 */
  minX: -66, maxX: -52,
  /** 升空点 z 范围（观景台正前方向）。 */
  minZ: -22, maxZ: -4,
  /** 船只/浮筒所在的吃水高度。 */
  waterY: 0.18,
});

export const OBSERVATION_DECK_VIEW = Object.freeze({
  /** 观景模式相机注视点（燃放海域中心偏西）。 */
  targetX: -58, targetZ: -12,
  /** 观景模式正交半高（越大视野越宽）。 */
  zoom: 13.5,
});
