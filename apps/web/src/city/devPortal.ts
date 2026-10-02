// 开发者视觉验证入口：访问 URL 带 `?dev` 时跳过登录层与新手引导，并保持
// 离线（不发起多人连接），配合 window._mini 的 teleport/focus 调试命令做
// 云端预览的视觉验证。仅影响带参访问，正常玩家零感知。
const DEV_PARAM = 'dev';

export function isDevPortalRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).has(DEV_PARAM);
  } catch {
    return false;
  }
}
