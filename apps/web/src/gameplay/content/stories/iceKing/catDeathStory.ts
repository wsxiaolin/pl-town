export type CatDeathCaptionTone = 'narration' | 'white' | 'black';

export type CatDeathCaptionCue = {
  start: number;
  end: number;
  speaker: string;
  line: string;
  tone: CatDeathCaptionTone;
};

export const CAT_DEATH_STORY_SECONDS = 83;
export const CAT_DEATH_TOTAL_SECONDS = 88;
export const CAT_DEATH_MAP_RETURN_MS = 1_800;

export const CAT_DEATH_CAPTION_CUES: readonly CatDeathCaptionCue[] = [
  { start: 0, end: 4.7, speaker: '旁白', tone: 'narration', line: '白色的小猫奔过绿色平原，把风和蒲公英都甩在身后。' },
  { start: 4.25, end: 8.55, speaker: '旁白', tone: 'narration', line: '它每天追着太阳跑，直到夕阳把影子拉得很长。' },
  { start: 8.1, end: 11.6, speaker: '旁白', tone: 'narration', line: '城里的猫咖却总停在一个温暖的午后。' },
  { start: 11.15, end: 14.15, speaker: '黑猫', tone: 'black', line: '（被抚摸得很舒服，轻轻地哼着）' },
  { start: 13.7, end: 17.1, speaker: '白猫', tone: 'white', line: '喵……黑色的家伙，每天都被人摸？' },
  { start: 16.65, end: 18.75, speaker: '黑猫', tone: 'black', line: '呜……？嗯喵。' },
  { start: 18.3, end: 21.7, speaker: '白猫', tone: 'white', line: '小煤球！你不会没有从这里出去过吧？' },
  { start: 21.25, end: 25.75, speaker: '黑猫', tone: 'black', line: '呜……为什么要出去？被人抚摸的感觉不好嘛喵……' },
  { start: 25.3, end: 28.8, speaker: '白猫', tone: 'white', line: '……还是喜欢在外边玩喵，自由自在喵。' },
  { start: 28.35, end: 33.15, speaker: '黑猫', tone: 'black', line: '被抱出去过几次喵，还是窝里舒服。要进来蹭蹭嘛喵？' },
  { start: 32.7, end: 34.5, speaker: '白猫', tone: 'white', line: '……' },
  { start: 34.05, end: 36.05, speaker: '黑猫', tone: 'black', line: '不喜欢嘛……' },
  { start: 35.6, end: 38.3, speaker: '白猫', tone: 'white', line: '被圈养可不是好事喵。' },
  { start: 37.85, end: 42.05, speaker: '黑猫', tone: 'black', line: '那……顺毛呢！你不需要顺毛嘛喵？' },
  { start: 41.6, end: 44, speaker: '白猫', tone: 'white', line: '我不需要人顺毛。' },
  { start: 43.55, end: 47.75, speaker: '黑猫', tone: 'black', line: '……那你一直在外面跑，死掉了怎么办喵？' },
  { start: 47.3, end: 49.7, speaker: '白猫', tone: 'white', line: '我宁可死在荒野。' },
  { start: 49.25, end: 51.95, speaker: '黑猫', tone: 'black', line: '可是……荒野不会替你顺毛。' },
  { start: 51.5, end: 53.3, speaker: '白猫', tone: 'white', line: '风会喵。' },
  { start: 52.85, end: 57.35, speaker: '旁白', tone: 'narration', line: '白猫跃出窗台。那一年，平原的雨季来得格外早。' },
  { start: 56.9, end: 61.4, speaker: '旁白', tone: 'narration', line: '黑猫仍守着最暖的垫子，却开始在每个黄昏望向门外。' },
  { start: 60.95, end: 66.15, speaker: '旁白', tone: 'narration', line: '直到风带回熟悉的气味：青草、泥土，还有一场已经停下的心跳。' },
  { start: 65.7, end: 68.9, speaker: '黑猫', tone: 'black', line: '你说宁可……原来不是在吓我喵。' },
  { start: 68.45, end: 71.45, speaker: '黑猫', tone: 'black', line: '我带你回家……不，你说荒野才是你的家。' },
  { start: 71, end: 75.6, speaker: '旁白', tone: 'narration', line: '黑猫刨开被雨浸软的泥土，把白猫安葬在风吹过的草坡。' },
  { start: 75.15, end: 78.6, speaker: '黑猫', tone: 'black', line: '晚安。风会替我来看你喵。' },
  { start: 78.15, end: 82.85, speaker: '旁白', tone: 'narration', line: '埋好最后一捧土，黑猫没有回头。它沿着白猫追逐夕阳的方向，第一次走向自己的自由。' },
];
