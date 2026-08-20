import { NPC_PROFILES } from '../data/npcs';
import type { Achievement, UnlockTier } from './progressionController';

export type AchievementDefinition = Achievement & { desc?: string; directOnly?: boolean };

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id:'citizen',       name:'居民落籍',      desc:'签下名字，成为这座城的居民',            check:s=>!!localStorage.getItem('minicityUser') },
  { id:'first_building',name:'第一次叩门',    desc:'进入任意一座建筑',                      check:s=>(s.buildingsVisited||[]).length>=1 },
  { id:'explorer_5',    name:'街区漫游者',    desc:'参观 5 座建筑',                         check:s=>(s.buildingsVisited||[]).length>=5 },
  { id:'explorer_10',   name:'城市测绘员',    desc:'参观 10 座建筑',                        check:s=>(s.buildingsVisited||[]).length>=10 },
  { id:'walker_100',    name:'长街行者',      desc:'累计步行 100 米',                       check:s=>(s.distance||0)>=100 },
  { id:'walker_500',    name:'环城暴走',      desc:'累计步行 500 米',                       check:s=>(s.distance||0)>=500 },
  { id:'chat_1',        name:'初次交谈',      desc:'和一位居民交谈',                        check:s=>(s.npcsTalked||0)>=1 },
  { id:'chat_all',      name:'城中人脉',      desc:'和每一位核心居民都交谈过',             check:s=>{
    const core=NPC_PROFILES.filter(p=>p.core).map(p=>p.id);
    return (s.npcsMet||[]).filter((id: string)=>core.includes(id)).length>=core.length;
  } },
  { id:'night_owl',     name:'守夜人',        desc:'第一次在夜里看这座城市',                check:s=>(s.nightToggles||0)>=1 },
  { id:'unlock_3',      name:'城市生长',      desc:'解锁 3 次城市变化',                     check:s=>(s.unlockLevel||0)>=3 },
  { id:'cat_cafe_note', name:'猫咖拾遗',      desc:'发现猫咖馆旁掉落的纸张',                  check:()=>false, directOnly:true },
  { id:'cat_death_remembrance',name:'我会记得你的喵！',desc:'完整观看猫咖冰墙中保存的影像',check:()=>false,directOnly:true },
  { id:'minicity_origin',name:'物实城缘起',    desc:'触碰城中守望已久的沃柑树',                check:()=>false, directOnly:true },
  { id:'dragonwell_assimilation',name:'被龙井同化',desc:'向爬满绿色植物的石井献上龙井茶',          check:()=>false, directOnly:true },
  { id:'west_beach_encounter',name:'海神的考验',desc:'在城市西侧海滩通过亦航海神的考验',check:()=>false,directOnly:true },
  { id:'echo_unnoticed',name:'无人问津',desc:'在回声中选择离开',check:()=>false,directOnly:true },
  { id:'echo_eternal_lie',name:'永恒的谎言',desc:'让故事继续循环',check:()=>false,directOnly:true },
  { id:'echo_real_echo',name:'真正的回声',desc:'以真实回应林澈',check:()=>false,directOnly:true },
  { id:'echo_true_dawn',name:'真正的黎明',desc:'完成回声的全部后日谈',check:()=>false,directOnly:true },
  { id:'wild_mushroom_stubborn',name:'吃一堑再吃一堑',desc:'明知会被放倒，还是又吃了一顿野生菌',check:()=>false,directOnly:true },
  { id:'wild_mushroom_local',name:'真正的云南人',desc:'签完免责声明，把餐馆吃到赔本',check:()=>false,directOnly:true },
  { id:'magi_87_cents',name:'一美元八十七美分',desc:'见证麦琪的礼物——有些礼物不能立刻使用，但它们已经完成了自己的使命',check:()=>false,directOnly:true },
  { id:'overcoat.recover',name:'至少它还认得我',desc:'今晚别走那条街——找回了外套，但它已经不是原来的那件了',check:()=>false,directOnly:true },
  { id:'overcoat.witness',name:'城市回应了',desc:'今晚别走那条街——三个人的声音比一个人的沉默更有力量',check:()=>false,directOnly:true },
  { id:'overcoat.ghost',name:'今晚别走那条街',desc:'今晚别走那条街——被忽略的人用同一种方式留下了痕迹',check:()=>false,directOnly:true },
  { id:'yesterday_witness',name:'见证者',desc:'把三十年前未说出口的故事接住',check:()=>false,directOnly:true },
  { id:'yesterday_silence',name:'沉默是金',desc:'选择让故事停留在沉默里',check:()=>false,directOnly:true },
  { id:'yesterday_true_dawn',name:'昨日之歌',desc:'完成昨日之歌的尾声',check:()=>false,directOnly:true },
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
