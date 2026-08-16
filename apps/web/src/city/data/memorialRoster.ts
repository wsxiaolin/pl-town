export interface MemorialEntry {
  name: string;
  note?: string;
}

export interface MemorialRoster {
  title: string;
  subtitle: string;
  dedication: string;
  intro: readonly string[];
  main: readonly MemorialEntry[];
  comments: readonly string[];
  footer: string;
}

export const MEMORIAL_ROSTER: MemorialRoster = {
  title: '物实永退用户纪念碑',
  subtitle: '名单由社区共同维护 · 管理人员可持续更新',
  dedication: '阴阳有序，命运无常。每一次告别，都是灵魂的返航。',
  intro: [
    '往生堂开业啦～往生堂定时大酬宾，',
    '阴阳有序，命运无常。',
    '每一次告别，都是灵魂的返航。',
    '你的名字，将被铭记。',
    '本堂恪守承诺，以诚信为本。',
    '往生堂，期待您的光临。',
    '吃饱喝饱！！！一路走好！！',
  ],
  main: [
    { name: '胡莱三国官方', note: '早期编辑' },
    { name: '骚掏表', note: '为早期排水做了突出贡献' },
    { name: '12332' },
    { name: 'Navinety', note: '为早期排水做了突出贡献' },
    { name: 'MuོOYU', note: '早期编辑' },
    { name: 'N2O5', note: '早期编辑' },
    { name: '疯狂的电池', note: '巨佬' },
    { name: '繁花曲线～～～' },
    { name: '青柠潜水版' },
    { name: '天文望远镜' },
    { name: 'Sciencer', note: '中、外区编辑' },
    { name: '0点618φ', note: '早期编辑' },
    { name: '勿用', note: '早期编辑' },
    { name: '小湘湘', note: '早期元老级用户' },
    { name: '原子吐息' },
    { name: '北戴河', note: '全物实首个实验的作者' },
    { name: '我是一个类地行星' },
    { name: '永退再见' },
    { name: '绿毛污龟', note: '早期活跃用户' },
    { name: '单抽出奇迹', note: '早期活跃用户' },
    { name: '将进酒' },
    { name: 'zhy' },
    { name: '艺术就是派大星' },
    { name: '墨言', note: '电学大佬' },
    { name: 'Deuterium', note: '小号为 deuterium' },
    { name: '已被封禁' },
    { name: 'ΤγρΗοοη', note: '长期退游' },
    { name: '回归现实的不那那' },
    { name: '深潜的屑编辑' },
    { name: '一个失败的文明' },
    { name: '红烧bai' },
    { name: '栏杆拍遍' },
    { name: '清華大學' },
    { name: '凡尔纳科幻之作' },
    { name: 'yooo梦', note: '电学大佬，肝帝' },
    { name: '凛墨', note: '永退 · 新用户，其作品有一定影响' },
    { name: '半国飞士', note: '优秀实验区创作者' },
  ],
  comments: [
    '小董', 'Goodenough', '一下', '一下子', 'Rubidium', '嘉心糖forever', '嘉心糖（退半年）',
    '木宣', 'lonely', 'MC我的世界', '班长大大', '苏芮', '摸金暂退（互助团原团长）', 'π的e次方',
    '堇舒~', '乌克兰兔子', '@饼如雨止', '量子衰变', '贺与墨', '三眼五显仙人', '钟离', '旅行者',
    '温迪', '应急食品', '神里绫华', '巴巴托斯', '外星小灰猫', '七七', '是橙子呀~', '呆萌小奶猫（半退）',
    '凡尔纳科幻之作', '物实文审部', '春天禁止入内', '月满西楼', '随风~', '岩王耂匕瞪', '奈川子',
    '无尽小涵', '小鸽子~', 'Forya', '地缚少年狛枝君', '屑米粥', '万年老六', '爱干饭的蓝猫',
    '阿乔（阿乔烤肉店店主）', '沃尔夫冈', '小的食物', '金秋老汉', '（秋）晨兮兮', '@凛墨（永退）',
    'PAPYRUS', 'Alpha~', 'Likeᝰ太空殖民者', '卋亓', '依宁', 'Sujiu', '一只sans（我是ULB）',
    '航班', '开朗的飞船', '逐影星辰', '梦蝶泣', '我住在海龟', 'Alpha', '百万伏特', 'Phenolphthalein',
    '六十五卦', 'NameGao', '某柴', '麻雀～', '@路易斯蒙登·哲', '远山浅', 'Silence～', '作业少吗',
    'xuzhengx', '穌噜穌噜啦啦', 'Stellapolaris', '绪山浦桑', 'Likeᝰ缺德的怪盗基德', '上岸的行端',
    '屑狗砸', '是叶天帝不是万叶', '宇智波鼬神', '冰冷的乙醇', '胡莱三国官方', 'Lapland理', '暂退的南风',
    '关注哥', '一般都是', '美味的历史君', '正在学习的初中生MC', '屑福泥是只furry～', '毕竟你空调',
    '一只小乌龟', '陆羽墨', '高贵的白猫', '令狐溯落', '台风潜艇', 'みづき', '高way', '兰xi', '一梦emo',
    '物理喳（我是贡品）', '实锤永消失的薛猫（我是香）（我是北冥薛猫，来祭奠的）', '是胡堂主呀（我是幽幽大行军）',
    '勿用', '12332', '江雨晨', '果糖含量ᝰFURRY～', '一只开心的全装仔', '三月小狐｜花香｜', '@|银狼|',
    '空白区域', '本仙追小灭和灭粉酱~', 'NintendoSwitch', '生成摘要', '扫兴客Sam', '涼枫', '契柒',
    '满级人类lv', 'FontaineBleau',
  ],
  footer: '未完待续 · 名单将随社区更新而不断补充',
};
