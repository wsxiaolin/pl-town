import type { CityDialogController, StoryDialogModel } from '../adapters/ui/cityDialogController';

export const WILD_MUSHROOM_ACHIEVEMENTS = {
  stubborn: { id: 'wild_mushroom_stubborn', name: '吃一堑再吃一堑' },
  local: { id: 'wild_mushroom_local', name: '真正的云南人' },
} as const;

const VISIT_STORAGE_KEY = 'minicityWildMushroomVisits';

export interface WildMushroomRestaurantOptions {
  getDialogs: () => Pick<CityDialogController, 'openStory' | 'closeNpc'> | null;
  burnCity: (onDone?: () => void) => boolean;
  awardAchievement: (id: string, name: string) => void;
  getStorage?: () => Pick<Storage, 'getItem' | 'setItem'>;
}

export interface WildMushroomRestaurant {
  interact(): void;
}

export function createWildMushroomRestaurant(options: WildMushroomRestaurantOptions): WildMushroomRestaurant {
  const storage = options.getStorage ?? (() => window.localStorage);

  const readVisits = (): number => {
    const raw = storage().getItem(VISIT_STORAGE_KEY);
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };
  const writeVisits = (count: number): void => storage().setItem(VISIT_STORAGE_KEY, String(count));

  const open = (story: StoryDialogModel): void => {
    options.getDialogs()?.openStory(story);
  };
  const close = (): void => {
    options.getDialogs()?.closeNpc();
  };
  const leaveOption = (text = '离开') => ({ text, onPick: () => close() });

  const burnThen = (after: () => void): void => {
    options.burnCity(after);
  };

  // 第一次：点「一年总要吃两次野生菌火锅」→ 3 个感叹号选项 → 火烧小城 → 镜子幻觉吐槽。
  const firstVisit = (): void => {
    const afterBurn = (): void => open({
      title: '野生菌餐馆',
      role: '醒来',
      text: '这镜子一看就是真的，都给我干出幻觉来了。',
      options: [leaveOption()],
    });
    const threeOptions = (): void => open({
      title: '野生菌餐馆',
      role: '老板把一大盘见手青倒进锅里',
      text: '「熟了再吃，没熟可要看见小人的。」',
      options: [
        { text: '我要吃！', onPick: () => burnThen(afterBurn) },
        { text: '我要吃！！', onPick: () => burnThen(afterBurn) },
        { text: '我要吃！！！', onPick: () => burnThen(afterBurn) },
      ],
    });
    open({
      title: '野生菌餐馆',
      role: '锅底翻滚着奶白色的汤',
      text: '老板招呼你坐下，锅里的汤咕嘟咕嘟地响。',
      options: [
        { text: '一年总要吃两次野生菌火锅', onPick: threeOptions },
      ],
    });
  };

  // 第二次：明知会被放倒还是吃，烧完解锁「吃一堑再吃一堑」。
  const secondVisit = (): void => {
    const afterBurn = (): void => {
      const ach = WILD_MUSHROOM_ACHIEVEMENTS.stubborn;
      options.awardAchievement(ach.id, ach.name);
      open({
        title: '野生菌餐馆',
        role: '又被放倒了',
        text: '熟悉的幻觉又来了，老板在一旁默默记下「常客 +1」。',
        options: [leaveOption()],
      });
    };
    open({
      title: '野生菌餐馆',
      role: '上次的事还记得吗',
      text: '上次被放倒的经历犹在眼前，你确定还要吃吗？',
      options: [
        { text: '没事，我到医院的路已经很熟了。', onPick: () => burnThen(afterBurn) },
        { text: '吃完后说不定就可以看到二次元老婆了。', onPick: () => burnThen(afterBurn) },
      ],
    });
  };

  // 第三次：老板劝退两连 → 逐项签免责声明 → 上菜再烧一次 → 解锁「真正的云南人」。
  const thirdVisit = (): void => {
    const afterBurn = (): void => {
      const ach = WILD_MUSHROOM_ACHIEVEMENTS.local;
      options.awardAchievement(ach.id, ach.name);
      open({
        title: '野生菌餐馆',
        role: '老板含泪上菜',
        text: '老板把免责声明收进抽屉，端上一锅翻滚的见手青：「真正的云南人，佩服佩服。」',
        options: [leaveOption()],
      });
    };
    const steps = [
      { role: '老板的忠告', text: '不要再来吃了。', pick: '……' },
      { role: '免责声明', text: '再吃餐馆都要赔倒闭了。', pick: '我自愿食用野生菌' },
      { role: '免责声明 · 第二项', text: '（你勾选了第一项）', pick: '本人已知晓其风险和后果' },
      { role: '免责声明 · 第三项', text: '（你勾选了第二项）', pick: '如果出现任何问题，本人及家属不得追究' },
      { role: '免责声明 · 上菜', text: '（你勾选了第三项）', pick: '老板上菜' },
    ] as const;
    const advance = (index: number): void => {
      const step = steps[index];
      if (!step) {
        burnThen(afterBurn);
        return;
      }
      open({
        title: '野生菌餐馆',
        role: step.role,
        text: step.text,
        options: [{ text: step.pick, onPick: () => advance(index + 1) }],
      });
    };
    advance(0);
  };

  function interact(): void {
    if (!options.getDialogs()) return;
    const visits = readVisits();
    writeVisits(visits + 1);
    if (visits === 0) firstVisit();
    else if (visits === 1) secondVisit();
    else thirdVisit();
  }

  return { interact };
}
