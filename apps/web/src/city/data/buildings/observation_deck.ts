// 建筑配置：observation_deck（海边观景台）
// 西海滩上的木质栈桥观景台：进入后镜头切到海面，依次观看全体居民
// 设计的烟花（部分会同时升起）。几何在 rendering/observationDeckBuilding.ts
// 单独建模，栈桥向西伸入海中。
import { defineBuilding, iconSvg } from './_types';
import { OBSERVATION_DECK_FEATURE_ID } from '../../fireworks/fireworksFeatureIds';

export default defineBuilding({
  id: "observation_deck",
  num: "70",
  label: "海边观景台",
  x: -39.8,
  z: -13,
  shape: "observation_deck",  hasPlot: false,  decorationClearance: 3,  interactionRadius: 10,

  icon: iconSvg(`<path d="M3 17h18"/><path d="M5 17v3M19 17v3"/><path d="M7 17V9h10v8"/><path d="M12 9V6"/><path d="M9.5 6h5"/><circle cx="12" cy="12" r="1.6"/>`),
  content: {
    name: "海边观景台",
    slogan: "涨潮的时候，连星星都会退后几步。",
    dialog: [
      "栈桥尽头的木平台上摆着几排长凳，栏木被海风磨得发亮。守台人说，晚上这里的视野最好——整片海都是烟花的花瓶。",
      "进入观景模式后，镜头会移到海上：所有居民设计并存入云端的烟花会依次升起，偶尔有几支约好了同时绽放。",
    ],
  },
  featureIds: [OBSERVATION_DECK_FEATURE_ID],
});
