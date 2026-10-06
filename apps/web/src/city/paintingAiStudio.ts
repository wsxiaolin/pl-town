// 「绘画+AI」画室剧情控制器：确认对话 → 打开画布 → 笔画变形为小城简笔轮廓 →
// 自动收起并送出表扬。纯流程编排：不碰 DOM / Three.js，画布与提示都经注入回调完成。
import type { CityDialogController, StoryDialogModel } from '../adapters/ui/cityDialogController';
import type { PaintingAiCanvasHandlers } from '../adapters/ui/paintingAiCanvasController';

export const PAINTING_AI_PRAISE = 'wow你真的太厉害了，随便一画就是此等高度';

export interface PaintingAiStudioOptions {
  getDialogs: () => Pick<CityDialogController, 'openStory' | 'closeNpc'> | null;
  openCanvas: (handlers: PaintingAiCanvasHandlers) => void;
  /** 静默收起画布（对话被外部关闭时兜底，不触发画布自己的完成/取消回调）。 */
  closeCanvas: () => void;
  showToast: (message: string) => void;
}

export type PaintingAiInteractResult = 'opened' | 'no-dialog';

export interface PaintingAiStudio {
  interact(onComplete?: () => void): PaintingAiInteractResult;
}

export function createPaintingAiStudio(options: PaintingAiStudioOptions): PaintingAiStudio {
  function interact(onComplete?: () => void): PaintingAiInteractResult {
    const dialogs = options.getDialogs();
    if (!dialogs) return 'no-dialog';
    let completed = false;
    const complete = (): void => {
      if (completed) return;
      completed = true;
      options.closeCanvas();
      dialogs.closeNpc();
      onComplete?.();
    };
    const story: StoryDialogModel = {
      title: '绘画+AI',
      role: 'AI 小画童举着一块空白画板',
      text: '欢迎来到绘画+AI 画室！需要快速学习绘画吗？——在这里，不管画成什么样，都会变成一座小城的简笔轮廓。',
      onClose: complete,
      options: [
        {
          text: '好呀，快速学！',
          onPick: () => options.openCanvas({
            onComplete: () => {
              // 先结算互动（closeNpc/visit 计数可能同步弹成就提示），
              // 表扬 toast 延后半拍，保证「此等高度」是玩家看到的最后一句。
              complete();
              window.setTimeout(() => options.showToast(PAINTING_AI_PRAISE), 400);
            },
            onCancel: complete,
          }),
        },
        { text: '先不了，改天再来', onPick: complete },
      ],
    };
    dialogs.openStory(story);
    return 'opened';
  }

  return { interact };
}
