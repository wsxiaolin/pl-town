import { WORLD_ACHIEVEMENTS } from '../../gameplay/progression/worldAchievements';
import type { UnlockTier } from './progressionController';

export type AchievementMeta = { id: string; name: string; desc?: string };

// Pure display metadata: unlocking happens on the server (stat achievements are
// evaluated from cloud progress; story achievements are unlocked on trigger).
export const ACHIEVEMENTS: readonly AchievementMeta[] = [
  { id:'citizen',       name:'居民落籍',      desc:'签下名字，成为这座城的居民' },
  { id:'first_building',name:'第一次叩门',    desc:'进入任意一座建筑' },
  { id:'explorer_5',    name:'街区漫游者',    desc:'参观 5 座建筑' },
  { id:'explorer_10',   name:'城市测绘员',    desc:'参观 10 座建筑' },
  { id:'unlock_3',      name:'城市生长',      desc:'解锁 3 次城市变化' },
  { ...WORLD_ACHIEVEMENTS.catCafeNote },
  { ...WORLD_ACHIEVEMENTS.catDeathRemembrance },
  { ...WORLD_ACHIEVEMENTS.cityOrigin },
  { id:'dragonwell_assimilation',name:'被龙井同化',desc:'向爬满绿色植物的石井献上龙井茶' },
  { id:'west_beach_encounter',name:'海神的考验',desc:'在城市西侧海滩通过亦航海神的考验' },
  { id:'echo_unnoticed',name:'无人问津',desc:'在回声中选择离开' },
  { id:'echo_eternal_lie',name:'永恒的谎言',desc:'让故事继续循环' },
  { id:'echo_real_echo',name:'真正的回声',desc:'以真实回应林澈' },
  { id:'echo_true_dawn',name:'真正的黎明',desc:'完成回声的全部后日谈' },
  { id:'wild_mushroom_stubborn',name:'吃一堑再吃一堑',desc:'明知会被放倒，还是又吃了一顿野生菌' },
  { id:'wild_mushroom_local',name:'真正的云南人',desc:'签完免责声明，把餐馆吃到赔本' },
  { id:'magi_87_cents',name:'一美元八十七美分',desc:'见证麦琪的礼物——有些礼物不能立刻使用，但它们已经完成了自己的使命' },
  { id:'overcoat.recover',name:'至少它还认得我',desc:'今晚别走那条街——找回了外套，但它已经不是原来的那件了' },
  { id:'overcoat.witness',name:'城市回应了',desc:'今晚别走那条街——三个人的声音比一个人的沉默更有力量' },
  { id:'overcoat.ghost',name:'今晚别走那条街',desc:'今晚别走那条街——被忽略的人用同一种方式留下了痕迹' },
  { id:'yesterday_witness',name:'见证者',desc:'把三十年前未说出口的故事接住' },
  { id:'yesterday_silence',name:'沉默是金',desc:'选择让故事停留在沉默里' },
  { id:'yesterday_true_dawn',name:'昨日之歌',desc:'完成昨日之歌的尾声' },
  { id:'murder_wanderer',name:'闲逛者',desc:'跟着莫得一起在城里散步' },
  { id:'murder_watcher',name:'视奸者',desc:'听莫得说他观察着每个人的一举一动' },
  { id:'murder_chain',name:'再串大四',desc:'和莫得对上了黑洞区的暗号' },
  { id:'murder_flirt',name:'搭讪',desc:'对莫得说出了那句搭讪的话' },
  { id:'murder_contact',name:'闲聊伙伴',desc:'从莫得那里要到了任意一种联系方式' },
];

export function createUnlockTiers(addLamps: (positions: [number, number, number][]) => void,
                                  addTrees: (positions: [number, number, number][]) => void,
                                  addArch: (x: number, y: number, z: number, rotY: number) => void,
                                  addBench: (x: number, y: number, z: number, rotY: number) => void): readonly UnlockTier[] {
  return [
    { threshold:2,  label:'a lamp post appeared',  fn: () => addLamps([[4.5,0,-6.8]]) },
    { threshold:5,  label:'a new tree sprouted',   fn: () => addTrees([[7.2,0,7.0]]) },
    { threshold:9,  label:'a stone arch revealed', fn: () => addArch(-5.5,0,5.8,-Math.PI/6) },
    { threshold:14, label:'a bench was placed',    fn: () => addBench(6.8,0,-1.5,Math.PI/3) },
  ];
}
