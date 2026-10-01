// 建筑配置：kingice
import { defineBuilding, iconSvg } from './_types';
import { ICE_KING_BUILDING_ID, ICE_SANCTUM_ACTIONS, ICE_SANCTUM_FEATURE_ID } from '../../../gameplay/content/stories/iceKing/iceKingContent';

export default defineBuilding({
  id: ICE_KING_BUILDING_ID,
  num: "30",
  label: "King Ice",
  x: 20,
  z: 20,
  shape: "crown",
  interactionRadius: 3.6,
  decorationClearance: 2,
  hasPlot: false,
  featureIds: [ICE_SANCTUM_FEATURE_ID],
  icon: iconSvg(`<path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>`),
  content: {
    name: "King Ice",
    slogan: "皇冠落座之处，冰与光交界。",
    dialog: ["这段话是ice自己写的，他直接推送到我代码仓库里面了"],
    dialogTree: [
      {
        text: "是否觐见【冰】",
        options: [
          {
            text: "是",
            next: null,
            action: ICE_SANCTUM_ACTIONS.enter,
          },
          { text: "否", next: null },
        ],
      },
    ],
  },
});
