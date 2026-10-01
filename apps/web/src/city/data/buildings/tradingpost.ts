// 建筑配置：tradingpost
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "tradingpost",
  num: "38",
  label: "交易所",
  x: 21,
  z: -33,
  shape: "bank",
  facade: "facade_market",
  icon: iconSvg(`<path d="M3 10h18v8H3z"/><path d="M3 10l9-5 9 5"/>`),
  content: {
    name: "交易所",
    slogan: "价值在这里被反复称量。",
    dialog: ["柜台上摆着各种代币和凭证。", "这里不仅交易货币，还交换信息、服务和承诺。", "「价格会波动，但信用不会。」"],
  },
});
