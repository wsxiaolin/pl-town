import type { StoryDefinition } from '../../stories/types';

export const ECHO_ACT_ONE: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: 'main.echo.act-one',
  title: '回声 · 第一幕：相遇',
  startNode: 'meeting',
  nodes: {
    meeting: {
      id: 'meeting', title: '林澈', role: '气象观测站守望人',
      text: '……好久没见到人了。\n\n你是来登山的吗？这条路很少有人走。',
      choices: [{ id: 'ask-alone', label: '你一个人住在这里？', next: 'not-alone' }],
    },
    'not-alone': {
      id: 'not-alone', title: '林澈', role: '气象观测站守望人',
      text: '嗯，一个人。\n\n不过……也不算完全一个人。',
      choices: [{ id: 'continue-memory', label: '继续', next: 'mountain-memory' }],
    },
    'mountain-memory': {
      id: 'mountain-memory', title: '回忆', presentation: 'cg',
      text: '她说过，最想来这座山。\n想在山顶看一次日出。\n想在这里，度过春夏秋冬。\n\n但她没能来。',
      choices: [{ id: 'continue-recording', label: '继续', next: 'recording' }],
    },
    recording: {
      id: 'recording', title: '林澈', role: '气象观测站守望人',
      text: '所以我替她来了。\n\n我每天记录这里的一切——天气、风、云的形状、山下的灯火。\n\n用录音笔讲给她听。这样的话……她就能知道这里是什么样子了。',
      choices: [{ id: 'ask-name', label: '她叫什么名字？', next: 'secret' }],
    },
    secret: {
      id: 'secret', title: '林澈', role: '气象观测站守望人',
      text: '嗯……这是我们之间的秘密。\n\n但她很喜欢这里。她说过，如果能在这里生活，一定每天都会很开心。',
      choices: [{ id: 'continue-stars', label: '继续', next: 'starlight-memory' }],
    },
    'starlight-memory': {
      id: 'starlight-memory', title: '回忆', presentation: 'cg',
      text: '她喜欢在窗边看星星。\n她说星星会听她说话。\n\n所以我每晚都会对着星空，\n把今天发生的事讲一遍。',
      choices: [{ id: 'continue-seasons', label: '继续', next: 'four-seasons' }],
    },
    'four-seasons': {
      id: 'four-seasons', title: '林澈', role: '气象观测站守望人',
      text: '今天是第237天。\n\n我会一直在这里，直到把四季都记录完。\n\n这样她就能看到春天的花、夏天的雨、秋天的叶子、冬天的雪。',
      choices: [{ id: 'say-miss', label: '你一定很想她。', next: 'request' }],
    },
    request: {
      id: 'request', title: '林澈', role: '气象观测站守望人',
      text: '嗯。每一天都想。\n\n但只要做这些事，就觉得……她还在身边。\n\n如果你下次还会来的话……能帮我一个忙吗？她最喜欢的食物，我想做给她。',
      choices: [{
        id: 'accept-wish', label: '我会帮你。', next: 'act-one-complete',
        effects: [{ type: 'event.publish', eventType: 'echo.act-one.completed' }],
      }],
    },
    'act-one-complete': {
      id: 'act-one-complete', title: '林澈', role: '气象观测站守望人', terminal: true,
      text: '谢谢。\n\n虽然她吃不到，但……至少我可以尝尝，然后告诉她是什么味道。\n\n【她的遗愿 · 其一】即将开启',
    },
  },
};
