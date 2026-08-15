import type { QuestDefinition } from '../../quests/types';

export const SIDE_QUESTS = [
  {
    schemaVersion: 1,
    definitionVersion: 1,
    id: 'side.azi.night-lights',
    kind: 'side',
    title: '夜灯传闻',
    summary: '替阿紫调查研究院深夜不熄的灯。',
    giverNpcId: 'azi',
    receiverNpcId: 'azi',
    offer: {
      optionLabel: '支线：调查夜灯传闻',
      text: '“你真愿意帮忙？先去研究院看看。白露嘴严，但楼里的线索不会说谎。”',
      confirmLabel: '我去调查',
      confirmedText: '“好！看清楚以后回来找我，我给这条新闻留头版。”',
    },
    completion: {
      optionLabel: '汇报研究院的发现',
      text: '“你回来了！研究院的灯究竟为什么整夜亮着？”',
      confirmLabel: '讲述调查经过',
      confirmedText: '阿紫飞快地记满一页纸。“这下头版有着落了。多谢，调查员。”',
    },
    stages: [
      {
        id: 'inspect-research',
        title: '前往研究院',
        description: '访问研究院，调查深夜灯光的传闻。',
        objectives: [
          {
            id: 'visit-research',
            description: '访问研究院',
            target: { type: 'building.visited', buildingId: 'research' },
            required: 1,
          },
        ],
      },
    ],
    repeatable: false,
  },
] as const satisfies readonly QuestDefinition[];
