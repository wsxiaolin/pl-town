// First-frame warm-up — links every shader program in the scene and renders a
// few warm-up frames (mirror water, sky, lighting programs + GPU texture
// upload) BEFORE the first visible frame, so visitors never watch a
// shader-compilation freeze. Runs on BOTH heavy and light boots; the frame
// loop stays held until this resolves. The boot watchdog's signal aborts the
// wait: the gate releases and the boot degrades to a plain (possibly janky)
// first frame — better than an eternal splash. Never rejects.
import type * as THREE from 'three';
import { abortable } from '../core/abortable';

type FrameLoop = { holdRender(): void; releaseRender(): void };

export type FirstFrameHandles = {
  renderer?: THREE.WebGLRenderer | null;
  scene?: THREE.Scene | null;
  camera?: THREE.Camera | null;
  frameLoop: FrameLoop;
};

export async function warmupFirstFrame(
  handles: FirstFrameHandles,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { renderer, scene, camera, frameLoop } = handles;
  try {
    if (!renderer || !scene || !camera) return;
    onProgress?.(0.15);
    await abortable(renderer.compileAsync(scene, camera), signal);
    onProgress?.(0.7);
    for (let i = 0; i < 3; i += 1) {
      if (signal?.aborted) break;
      renderer.render(scene, camera);
      onProgress?.(0.7 + (i + 1) * 0.1);
      await abortable(new Promise((resolve) => requestAnimationFrame(resolve)), signal);
    }
    onProgress?.(1);
  } catch (error) {
    console.error('First-frame precompile failed', error);
  } finally {
    frameLoop.releaseRender();
  }
}
