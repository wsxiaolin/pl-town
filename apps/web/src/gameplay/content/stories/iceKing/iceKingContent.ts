export const ICE_KING_BUILDING_ID = 'kingice';
export const ICE_SANCTUM_FEATURE_ID = 'ice-sanctum';

export const ICE_SANCTUM_ACTIONS = Object.freeze({
  enter: 'ice:enter',
});

export type IceSanctumEnding = 'accept' | 'reject';
export type IceSanctumReturnWeather = 'rain' | 'sunny';

export const ICE_KING_ITEMS = Object.freeze({
  wetCrown: {
    id: 'ice_wet_crown',
    name: '湿湿的皇冠',
    detail: '真奇怪，明明没淋到雨的',
    icon: '冠',
  },
  lemonade: {
    id: 'ice_lemonade',
    name: '冰镇柠檬水',
    detail: '冰镇柠檬水，可作为任意一种道具提交。\n真奇怪，这里头的冰块似乎怎么都不会化',
    icon: '柠',
  },
});

export const ICE_KING_REWARDS = Object.freeze({
  reject: {
    id: 'ice_reject',
    item: ICE_KING_ITEMS.wetCrown,
    weather: 'rain' as const,
    claimedMessage: '湿湿的皇冠已放入背包',
    confirmedMessage: '湿湿的皇冠领取状态已确认',
    failedMessage: '湿湿的皇冠领取失败',
  },
  accept: {
    id: 'ice_accept',
    item: ICE_KING_ITEMS.lemonade,
    weather: 'sunny' as const,
    claimedMessage: '冰镇柠檬水已放入背包',
    confirmedMessage: '冰镇柠檬水领取状态已确认',
    failedMessage: '冰镇柠檬水领取失败',
  },
});

export type IceKingRewardId = (typeof ICE_KING_REWARDS)[keyof typeof ICE_KING_REWARDS]['id'];

export const ICE_KING_REPEATABLE_RESIDENT_ID = 'ice';
export const ICE_SANCTUM_CHOICE_STORAGE_PREFIX = 'minicityIceChoice:';

export const CAT_CAFE_ICE_WALL = Object.freeze({
  interestPointId: 'cat-cafe-ice-wall',
  title: '不会融化的冰墙',
  copy: '听说保存信息最久的方式是把字刻在石头上……一块不会融化的冰应该也差不多',
  useItemOption: '#放上冰镇柠檬水',
});

export const CAT_DEATH_ACHIEVEMENT = Object.freeze({
  id: 'cat_death_remembrance',
  name: '我会记得你的喵！',
  desc: '完整观看猫咖冰墙中保存的影像',
});
