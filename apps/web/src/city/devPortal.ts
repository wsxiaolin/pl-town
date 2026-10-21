// 开发者视觉验证入口：访问 URL 带 `?dev` 时跳过登录层与新手引导，并保持
// 离线（不发起多人连接），配合 window._mini 的 teleport/focus 调试命令做
// 云端预览的视觉验证。仅影响带参访问，正常玩家零感知。
//
// 为了方便验证经济与移动相关的界面，`?dev` 还会开启本地开发特权：
// 无限金币（仅本地显示与前置校验，离线仍不能真正结算购买）、传送解锁、
// 移动速度加倍。这些覆盖都发生在客户端，不会访问或修改服务端数据。
const DEV_PARAM = 'dev';

/** 开发门户显示的余额；仅用于本地 UI 与前置余额校验。 */
export const DEV_UNLIMITED_CURRENCY = 999_999_999;

/** 开发门户的移动速度倍率（桌面路径移动与第一人称共用）。 */
export const DEV_SPEED_MULTIPLIER = 2;

export function isDevPortalRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).has(DEV_PARAM);
  } catch {
    return false;
  }
}

/** 把基础移动速度换算成当前入口生效的速度。 */
export function resolvePlayerSpeed(baseSpeed: number): number {
  return isDevPortalRequested() ? baseSpeed * DEV_SPEED_MULTIPLIER : baseSpeed;
}
