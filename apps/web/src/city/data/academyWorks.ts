export type AcademyWork = {
  id: string;
  title: string;
  author: string;
  category: string;
  excerpt: string;
  content: string[];
};

export const ACADEMY_WORKS = {
  title: '书院',
  subtitle: '书页在此停驻，供来访者安静翻阅。',
  works: [
    { id: 'night-corridor', title: '夜廊', author: '无署名', category: '短篇', excerpt: '灯光沿着石阶铺开，晚归的人把脚步放得很轻。', content: ['入夜以后，书院的廊灯总会比街灯早亮一会儿。', '有人说这是为了照见归路，也有人说是为了让窗里的读书人知道，外面仍有一座安静醒着的城。', '风从檐下穿过，翻动桌上一页未写完的纸。'] },
    { id: 'margin-note', title: '页边批注', author: '南窗', category: '随笔', excerpt: '一段话被认真读过，便会在纸边留下新的光。', content: ['读书时，我常常先看见页边。', '那里有前人留下的疑问、惊叹和改正，像一条条很短的来信。', '它们提醒我，文字从来没有真正结束，它只是在等待下一位读者。'] },
    { id: 'small-window', title: '小窗', author: '林间', category: '诗歌', excerpt: '一方窗框装下云影，也装下翻页时忽然停住的心。', content: ['小窗向着北面开。', '云过的时候，屋里先暗下来，随后又慢慢亮起。', '我把书摊在桌上，等这一阵光把下一行字照清。'] },
  ] satisfies AcademyWork[],
} as const;
