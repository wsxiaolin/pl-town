// Render-resolution policy shared by the renderer, the settings drawer, and
// the adaptive pixel-ratio controller. Kept as a leaf module with no
// module-scope browser APIs so node-side unit tests (and any consumer) can
// import it without dragging WebGL/matchMedia initialization along.

/** 移动端视口判定与档位天花板共用一个宽度阈值（与历史断点保持一致）。 */
export const MOBILE_VIEWPORT_MAX_WIDTH = 680;

/** 手机 GPU 的填充率/顶点吞吐有限：预设或自适应起点若跑到设备上限
 *  （pixelRatio 可达 4），等于 16 倍于 1.0 的像素量，自适应控制器要花几十
 *  秒才能降回可玩档。预设建议值与自适应起点一律先过这道钳制；手动滑杆
 *  仍可突破（高级用户自担，运行期由自适应分辨率兜底）。 */
export const MOBILE_RESOLUTION_CEILING = 2;

export function isMobileViewport(viewportWidth: number): boolean {
  return viewportWidth <= MOBILE_VIEWPORT_MAX_WIDTH;
}

/** 预设/自适应起点在移动端的统一钳制出口（桌面原样通过）。 */
export function clampResolutionForViewport(resolution: number, viewportWidth: number): number {
  return isMobileViewport(viewportWidth)
    ? Math.min(resolution, MOBILE_RESOLUTION_CEILING)
    : resolution;
}
