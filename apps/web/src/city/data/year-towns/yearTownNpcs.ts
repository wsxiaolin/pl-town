// 年份镇主题 NPC（T6R-b4，wave3c 扩编至 28 名）：每镇 3–4 名迎宾/守镇角色
// （2019 起源村 3 名），数据模式复用 city/data/npcs.ts 的 NpcProfile，在
// cityWorldAssembly 与 NPC_PROFILES 同管道合流（behavior:'field'、home==work、
// patrolRadius:0 → 定点迎宾；ROAD_COORDS 主城路网不可达 → 永不漂移，主城
// NPC 行为不变）。
//
// 落位契约（yearTownDecor.ts 头注）：迎宾带/大街两侧，勿占大街对景视廊
// 与站泊位。坐标随 districtLayout 的运行时建筑布局生成（以所属地标为锚、
// 3.2u 邻位），并经 yearTownNpcAudit 固化不变量：台缘 r ≤ plateauR−2.2、
// 建筑中心距 ≥ 2.9、|lat| ≥ 2.6；2019 手工点 (98.4, 201.6) 保持原值。
//
// 台词来源：data/blackhole_top1000.json 各年 Top1–3 作品的标题/标签再创作
// （意象化引用，不逐字抄正文；正文由年份镇建筑面板承载）。
import type { NpcProfile } from '../../npcSystem';

/** 年份镇 NPC 档案（28 名：2019×3，2021/2022/2023/2026×4，2020/2024/2025×3）。 */
export const YEAR_TOWN_NPCS: readonly NpcProfile[] = [
  // ── 2019 起源村 ×3：《管理条例》(2019) → 碑上公约；「高频」装置集合 → 心跳滴答；
  //    南湾泊口 → 摆渡人；千作总目塔 → 塔下计数人 ──
  {
    id:'yt2019-lamplighter', name:'守灯人', role:'起源村 · 村口守灯人', core:false, spawnChance:1,
    behavior:'field', workHours:[0,24],
    head:0xE8D8C8, body:0xB59A6A, home:[145,218], work:[145,218], patrolRadius:0,
    dialog:[
      { text:'「欢迎来到一切开始的地方。荒原上的第一盏灯，就是我点的。」', options:[
        { text:'这里只有两栋屋？', next:1 },
        { text:'你在守什么？', next:2 },
        { text:'（告辞）', next:null },
      ]},
      { text:'「当年就两栋屋、一块碑。村里所有的规矩，最早是从碑上那页公约开始的——风吹过来，纸页哗啦响，像整个村子在念它。」', options:[
        { text:'公约写了什么？', next:2 },
        { text:'真难想象。', next:null },
      ]},
      { text:'「我在守那台老装置。它一断一开、一断一开地滴答了这么多年——村子最原始的心跳。你听，现在还在跳。」', options:[
        { text:'听到了。', next:null },
        { text:'祝村子长长久久。', next:null },
      ]},
    ],
  },
  {
    id:'yt2019-ferryman', name:'渡爷', role:'起源村 · 南湾摆渡人', core:false, spawnChance:1,
    behavior:'field', workHours:[6,20],
    head:0xD8BBA0, body:0x6A7A6A, home:[150,223], work:[150,223], patrolRadius:0,
    dialog:[
      { text:'「顺着这条栈道走到头就是泊口。坐我的船？先说好——渡免费，故事管够。」', options:[
        { text:'去哪儿都行？', next:1 },
        { text:'（沿栈道看看）', next:null },
      ]},
      { text:'「当年村里没有桥，进出全靠我这条船。南湾的鱼、窑上的砖、碑上的石头，都是一桨一桨运进来的。后来修了桥，船就闲下来了——闲着，也天天擦。」', options:[
        { text:'还出海吗？', next:2 },
        { text:'船真老。', next:null },
      ]},
      { text:'「出。哪年村里添了新屋、立了新碑，我就载着村里的后生绕岛一圈——让他们看看，自己住的地方从水上看是什么样。要看吗？潮平的时候最好看。」', options:[
        { text:'要看的。', next:null },
        { text:'下次一定。', next:null },
      ]},
    ],
  },
  {
    id:'yt2019-tallyman', name:'数塔人', role:'起源村 · 塔下计数人', core:false, spawnChance:1,
    behavior:'field', workHours:[9,18],
    head:0xE0C8B0, body:0x8A7A5A, home:[142.5,197.5], work:[142.5,197.5], patrolRadius:0,
    dialog:[
      { text:'「嘘——别踩乱我的石子。塔里立着历年的册子，我在塔底下数：今年，村里又添了几件做成了的事。」', options:[
        { text:'怎么个数法？', next:1 },
        { text:'（不打扰了）', next:null },
      ]},
      { text:'「一颗石子是一件。日子好的一年，石子多得袋子装不下；日子难的一年，就三两颗。但你猜怎么着——没有哪年是一颗都没有的。一年一年数下来，村子就是这么长大的。」', options:[
        { text:'今年几颗了？', next:2 },
        { text:'数得真细。', next:null },
      ]},
      { text:'「今天刚数到一颗新的。谁做的不重要——重要的是又一颗。塔上的册子记名姓，我这里只记『又』字。」', options:[
        { text:'（看了看那袋石子）', next:null },
      ]},
    ],
  },
  // ── 2020 启明镇 ×3：养成计划/致新用户 → 学堂向导；恒星的一生 → 观星人；
  //    议事厅与站前市集 → 市集管事 ──
  {
    id:'yt2020-guide', name:'晨星向导', role:'启明镇 · 晨星学堂向导', core:false, spawnChance:1,
    behavior:'field', workHours:[8,18],
    head:0xD7B49A, body:0x8FA3B8, home:[-21,252.1], work:[-21,252.1], patrolRadius:0,
    dialog:[
      { text:'「新来的吧？欢迎！启明镇的入门手册我都背下来了——这一页是基础，这一页是进阶。」', options:[
        { text:'你在教什么？', next:1 },
        { text:'我只是路过。', next:null },
      ]},
      { text:'「养成计划嘛：先学会搭第一个电路，再学会提一个好问题。手册上教的，我照做，居然真有用。」', options:[
        { text:'好问题是什么？', next:2 },
        { text:'有意思。', next:null },
      ]},
      { text:'「手册最后一页写着：把你会的，讲给下一个新来的人。所以我站在这儿。」', options:[
        { text:'受教了。', next:null },
      ]},
    ],
  },
  {
    id:'yt2020-stargazer', name:'观星人', role:'启明镇 · 观星人', core:false, spawnChance:1,
    behavior:'field', workHours:[20,6],
    head:0xE0C0A8, body:0x5A6A8A, home:[-13.3,243.2], work:[-13.3,243.2], patrolRadius:0,
    dialog:[
      { text:'「嘘——等一颗亮起来。启明镇的夜空，是这一带最好的。」', options:[
        { text:'在看什么？', next:1 },
        { text:'（安静地陪一会儿）', next:null },
      ]},
      { text:'「恒星的一生啊。从一团比什么都稀薄的星尘开始，聚啊聚，聚到中心发烫，就点着了。烧很久很久，最后一口气吹散成新的星云。」', options:[
        { text:'那它算结束了吗？', next:2 },
        { text:'真浪漫。', next:null },
      ]},
      { text:'「不算。散掉的星尘会聚成下一颗。我们这儿也一样——老人退场，新人进场，天一直亮着。」', options:[
        { text:'我懂了。', next:null },
      ]},
    ],
  },
  {
    id:'yt2020-marketwarden', name:'市集管事', role:'启明镇 · 站前市集管事', core:false, spawnChance:1,
    behavior:'field', workHours:[7,19],
    head:0xD8B49A, body:0x7A6A55, home:[14,247], work:[14,247], patrolRadius:0,
    dialog:[
      { text:'「逛市集？先说好——启明镇的摊子不宰客。这座城是从城门和市政厅长起来的，规矩立得早。」', options:[
        { text:'有什么好货？', next:1 },
        { text:'你在管什么？', next:2 },
        { text:'（随便看看）', next:null },
      ]},
      { text:'「早上的鱼、午后的炭、傍晚的糖画，各有时辰。要是拿不准主意，去对街议事厅问一句——那儿的提案板上，连『市集该开到几点』都表决过。」', options:[
        { text:'真什么都表决？', next:2 },
        { text:'那就去见识下。', next:null },
      ]},
      { text:'「什么都表决。当年『新人要不要发入门手册』就是在这儿吵出来的——后来手册人手一册，新来的再没迷过路。你看，管市集和管城市，是同一门手艺。」', options:[
        { text:'受教了。', next:null },
      ]},
    ],
  },
  // ── 2021 潮声镇 ×4：真·第一聊天室 → 守墙人；三代 → 潮汐记录；四代 → 拾贝人；
  //    鱼市街早市 → 鱼市摊主 ──
  {
    id:'yt2021-wallkeeper', name:'守墙人', role:'潮声镇 · 初代守墙人', core:false, spawnChance:1,
    behavior:'field', workHours:[7,23],
    head:0xD6B2A0, body:0x7A8A7E, home:[29.9,220.9], work:[29.9,220.9], patrolRadius:0,
    dialog:[
      { text:'「这面墙，是全镇最老的一面。第一句留言刻在最上头——现在潮水一涨，正好淹到那行字。」', options:[
        { text:'墙上都写什么？', next:1 },
        { text:'谁写的第一句？', next:2 },
        { text:'（去别处逛逛）', next:null },
      ]},
      { text:'「什么都写。问候、吵架、问作业、道晚安。一代人刷满了，下一代人接着刷。墙不挑话，潮声镇也不挑人。」', options:[
        { text:'吵得最凶的是哪句？', next:2 },
        { text:'真好啊。', next:null },
      ]},
      { text:'「第一句嘛……是个很无聊的问题。但回它的人，后来把整面墙都聊满了。你也要留一句吗？趁潮还没涨。」', options:[
        { text:'（留一句）', next:null },
        { text:'下次吧。', next:null },
      ]},
    ],
  },
  {
    id:'yt2021-recorder', name:'潮汐记录员', role:'潮声镇 · 潮汐记录员', core:false, spawnChance:1,
    behavior:'field', workHours:[9,17],
    head:0xC89973, body:0x4A6A7A, home:[34.3,225.7], work:[34.3,225.7], patrolRadius:0,
    dialog:[
      { text:'「第三本了。前两本记满了，锁在镇公所的柜子里。」', options:[
        { text:'记什么？', next:1 },
        { text:'（看一眼本子）', next:null },
      ]},
      { text:'「留言的潮汐。哪天潮涨——就是有人开了新话题，一晚上几百条；哪天潮退——好几天没人吭声。潮退的时候别慌，老住户都知道：退潮不是结束，是话在攒劲。」', options:[
        { text:'潮还会涨吗？', next:2 },
        { text:'记得真细。', next:null },
      ]},
      { text:'「一定涨。这镇子好几年了，潮退了多少次，就涨回来多少次。我只负责在本子上画波浪线。」', options:[
        { text:'辛苦了。', next:null },
      ]},
    ],
  },
  {
    id:'yt2021-beachcomber', name:'拾贝人', role:'潮声镇 · 退潮拾贝人', core:false, spawnChance:1,
    behavior:'field', workHours:[6,12],
    head:0xE3B7A0, body:0x9A8A6A, home:[51.6,238.9], work:[51.6,238.9], patrolRadius:0,
    dialog:[
      { text:'「退潮以后滩上全是好东西——别人聊剩的话题、没人接的下半句、还有一句问了好几天没人答的问题。」', options:[
        { text:'你捡这些做什么？', next:1 },
        { text:'那句问题是什么？', next:2 },
        { text:'（继续赶路）', next:null },
      ]},
      { text:'「收着。等哪代人回来，翻出来接着聊。第四代走的时候说要『周末再上』——我信他们，潮水记得自己的时间。」', options:[
        { text:'你也走吗？', next:2 },
        { text:'真执著。', next:null },
      ]},
      { text:'「我周末也上。」', options:[
        { text:'……好巧。', next:null },
      ]},
    ],
  },
  {
    id:'yt2021-fishmonger', name:'鱼市阿香', role:'潮声镇 · 鱼市摊主', core:false, spawnChance:1,
    behavior:'field', workHours:[4,12],
    head:0xE3B7A0, body:0x8A6A55, home:[33,257.5], work:[33,257.5], patrolRadius:0,
    dialog:[
      { text:'「赶早的吧？头一网带鱼刚卸，还带着海腥气。晚一步，就只剩别人挑剩的了。」', options:[
        { text:'来一尾。', next:1 },
        { text:'每天这么早？', next:2 },
        { text:'（改天再来）', next:null },
      ]},
      { text:'「四点起，五点开市，日头一高就收摊。鱼跟留言一个脾气——都得趁鲜。潮水什么时候涨，鱼什么时候到，比镇公所的钟还准。」', options:[
        { text:'你也看潮汐表？', next:2 },
        { text:'听着就新鲜。', next:null },
      ]},
      { text:'「不用表。守墙人看墙上的潮，我看水里的潮——都是一代一代传下来的读法。你要真想懂这座镇，先学会等。」', options:[
        { text:'那我等着。', next:null },
      ]},
    ],
  },
  // ── 2022 盛夏镇 ×4：《管理条例》(新) → 文书；特殊功能大全 → 收藏家；
  //    HTML艺术字 → 招牌匠；西馆区 → 馆区司钥 ──
  {
    id:'yt2022-clerk', name:'条例文书', role:'盛夏镇 · 条例文书', core:false, spawnChance:1,
    behavior:'field', workHours:[9,17],
    head:0xC8B89A, body:0x8A7A5A, home:[17,297], work:[17,297], patrolRadius:0,
    dialog:[
      { text:'「盛夏镇办事有条章。新章的墨迹干了才三天，你要办事，先看墙上那份。」', options:[
        { text:'写了什么？', next:1 },
        { text:'为什么要重写？', next:2 },
        { text:'不看，谢谢。', next:null },
      ]},
      { text:'「老规矩新条款：发言要留德，改编先问主，精选得过审。一句话——热闹归热闹，别把桌子掀了。」', options:[
        { text:'规矩真多。', next:2 },
        { text:'记住了。', next:null },
      ]},
      { text:'「盛世嘛。两百多栋楼是这一年竖起来的，没有章法，塔就塌了。规矩不是拦人，是撑人。」', options:[
        { text:'说得真好。', next:null },
      ]},
    ],
  },
  {
    id:'yt2022-collector', name:'收藏家', role:'盛夏镇 · 功能收藏家', core:false, spawnChance:1,
    behavior:'field', workHours:[10,20],
    head:0xD4A574, body:0x5A6A5A, home:[3,297], work:[3,297], patrolRadius:0,
    dialog:[
      { text:'「想学点别人不知道的？我这本大全册，盛夏镇独一份。」', options:[
        { text:'大全册里有什么？', next:1 },
        { text:'你发现的？', next:2 },
        { text:'不了。', next:null },
      ]},
      { text:'「小功能、暗门、奇技淫巧——工具的、实验的、画画的，全有。页边还留着空，等下一个人补新招。」', options:[
        { text:'都是你发现的？', next:2 },
        { text:'借我看看！', next:3 },
      ]},
      { text:'「我可不敢贪功——我只是收藏的，招是别人发现的。要谢，谢页边那些名字。」', options:[
        { text:'借我看看！', next:3 },
        { text:'收藏也不容易。', next:null },
      ]},
      { text:'「（他翻开册子，每一页都密密麻麻，页脚写满名字。）拿稳，别折角。」', options:[
        { text:'（小心翻阅）', next:null },
      ]},
    ],
  },
  {
    id:'yt2022-signmaker', name:'招牌匠', role:'盛夏镇 · 艺术字招牌匠', core:false, spawnChance:1,
    behavior:'field', workHours:[8,16],
    head:0xC68642, body:0x9A6A4A, home:[-0.4,294.8], work:[-0.4,294.8], patrolRadius:0,
    dialog:[
      { text:'「抬头看——全镇的招牌，一半出自我的手笔。会发光的、会变色的、会拐弯的字，都有。」', options:[
        { text:'怎么做到的？', next:1 },
        { text:'哪块最难？', next:2 },
        { text:'（抬头看）', next:null },
      ]},
      { text:'「手艺不外传……好吧，其实是字排对了地方，自己就会说话。你在别处看到的漂亮字体，十有八九学的是盛夏镇。」', options:[
        { text:'这么厉害？', next:2 },
        { text:'行行行。', next:null },
      ]},
      { text:'「最难的啊，是『欢迎』两个字。要让刚下船的人一眼看懂，又不俗气——这活儿我练了一整个盛夏。」', options:[
        { text:'确实不俗。', next:null },
      ]},
    ],
  },
  {
    id:'yt2022-westcurator', name:'馆区司钥', role:'盛夏镇 · 西馆区管理员', core:false, spawnChance:1,
    behavior:'field', workHours:[9,18],
    head:0xC8B89A, body:0x5A6A6A, home:[-33.5,291], work:[-33.5,291], patrolRadius:0,
    dialog:[
      { text:'「往西走是西馆区——律法厅、书院、纪念堂都在那一带，庄重得很。我管开馆锁门，也管提醒来客：那一带说话要轻。」', options:[
        { text:'为什么都要轻？', next:1 },
        { text:'带我去看看。', next:2 },
        { text:'（往别处去）', next:null },
      ]},
      { text:'「馆里存的东西不怕吵，怕的是敷衍。条文、讲义、名录，都是有人一笔一笔立起来的。脚步放轻，是替写字的人把桌子扶稳。」', options:[
        { text:'说得郑重。', next:2 },
        { text:'明白了。', next:null },
      ]},
      { text:'「从这往西，过了灯市街就是。傍晚灯柱一亮，整条路像被谁描过一遍——那年立馆的人说，学问也得有个体面的门脸。」', options:[
        { text:'这就去。', next:null },
      ]},
    ],
  },
  // ── 2023 回响镇 ×4：科特维酒馆 → 当班酒保；关于我 → 讲故事的人；
  //    金月店 → 月饼师傅；南码头 → 引水员 ──
  {
    id:'yt2023-barkeep', name:'当班酒保', role:'回响镇 · 科特维酒馆当班酒保', core:false, spawnChance:1,
    behavior:'field', workHours:[18,2],
    head:0xBFA58E, body:0x6E5A4A, home:[61,271.9], work:[61,271.9], patrolRadius:0,
    dialog:[
      { text:'「坐吧。科特维就这条件——油灯昏、椅子旧，酒是掺的，故事是真的。」', options:[
        { text:'这里是酒馆？', next:1 },
        { text:'来一杯。', next:2 },
        { text:'（转身走）', next:null },
      ]},
      { text:'「地下城的酒馆，开了不知多少年。酒保换了一茬又一茬——今晚是我当班。你要听故事，还是要下酒的话？」', options:[
        { text:'来一杯。', next:2 },
        { text:'酒保都去哪了？', next:3 },
      ]},
      { text:'「（他推过来一只缺口的杯子。液体颜色存疑，味道……也存疑。）回响镇的规矩：第一杯，管够。」', options:[
        { text:'（喝）', next:4 },
        { text:'（还是放下了）', next:null },
      ]},
      { text:'「有的当了船长，有的回了地上，有的就坐进客人堆里不出来了。酒馆记得每一个人——墙上那圈刻痕，就是他们留下的。」', options:[
        { text:'（看向墙上的刻痕）', next:null },
      ]},
      { text:'「……劲儿大吧？喝完记得早点回船上。夜里涨潮，回响镇的巷子会认生。」', options:[
        { text:'（晕乎乎地道谢）', next:null },
      ]},
    ],
  },
  {
    id:'yt2023-storyteller', name:'讲故事的人', role:'回响镇 · 讲故事的人', core:false, spawnChance:1,
    behavior:'field', workHours:[10,22],
    head:0xE8C4A0, body:0x8A6A8A, home:[25.2,296.1], work:[25.2,296.1], patrolRadius:0,
    dialog:[
      { text:'「你路过的时候，正好——我把自己的故事讲到第三章了，还缺个听众。」', options:[
        { text:'讲的是谁？', next:1 },
        { text:'（坐下听）', next:2 },
        { text:'（悄悄绕开）', next:null },
      ]},
      { text:'「我自己。从很远的地方来的那种开头，中间有一段不太亮堂的日子——但我把它写下来了，写下来它就伤不到我了。」', options:[
        { text:'后来呢？', next:2 },
        { text:'需要我做什么？', next:3 },
      ]},
      { text:'「后来遇到一些人，故事就拐了弯，往暖的地方去了。今晚讲到这儿，明天接着讲——我的故事，得慢慢讲。」', options:[
        { text:'明天见。', next:null },
      ]},
      { text:'「什么都不用做。听着就行。有人愿意听完，故事就算活着。」', options:[
        { text:'那我听着。', next:2 },
      ]},
    ],
  },
  {
    id:'yt2023-baker', name:'月饼师傅', role:'回响镇 · 金月店师傅', core:false, spawnChance:1,
    behavior:'field', workHours:[7,19],
    head:0xE0B890, body:0xA05A2A, home:[53.1,284], work:[53.1,284], patrolRadius:0,
    dialog:[
      { text:'「金月店，镇上独一份。招牌货：五金月饼，配一瓶山泉——别处你买不着。」', options:[
        { text:'五金月饼是什么？', next:1 },
        { text:'来一套。', next:2 },
        { text:'为什么叫金月？', next:3 },
      ]},
      { text:'「五个『金』字打头的馅料烤的月饼。硬，是真的硬——但回响镇的人就好这口实在。」', options:[
        { text:'来一套。', next:2 },
        { text:'听着就硌牙。', next:3 },
      ]},
      { text:'「（他递过一只油纸包，冰凉的山泉水瓶身上还挂着雾。）拿好。奖牌都退了，手艺不退。」', options:[
        { text:'谢了。', next:null },
      ]},
      { text:'「烤月饼那晚，月亮是金色的。就这么简单。做吃食的起名，不用想太多。」', options:[
        { text:'实在。', next:null },
      ]},
    ],
  },
  {
    id:'yt2023-pilot', name:'老引水', role:'回响镇 · 南码头引水员', core:false, spawnChance:1,
    behavior:'field', workHours:[5,15],
    head:0xC99973, body:0x4A5A4A, home:[15,412], work:[15,412], patrolRadius:0,
    dialog:[
      { text:'「从东滩街一直往南，过了海堤就是南码头。船要进港，都得听我引——这片水道底下暗礁的脾气，我闭着眼都数得出来。」', options:[
        { text:'引水难吗？', next:1 },
        { text:'南码头什么样？', next:2 },
        { text:'（不打扰了）', next:null },
      ]},
      { text:'「难的不是水，是人。夜里回来的船，船上的人都攥着一年的心事。我把他们一个个引到泊位上，看他们踩上码头那一下——肩膀松了，就到家了。」', options:[
        { text:'都在等家。', next:2 },
        { text:'真责任重大。', next:null },
      ]},
      { text:'「回响镇嘛，回响回响——喊一嗓子，得有人应。码头上的灯就是应答：你在海上喊，它在岸上亮。干这行三十年，我就信这个。」', options:[
        { text:'（望向码头的灯）', next:null },
      ]},
    ],
  },
  // ── 2024 微光镇 ×3：鸽子协会聊天室 → 鸽咖饲养员；死人微活四处游荡 →
  //    夜灯巡夜人；实验园区 → 门卫 ──
  {
    id:'yt2024-keeper', name:'鸽咖饲养员', role:'微光镇 · 鸽咖饲养员', core:false, spawnChance:1,
    behavior:'field', workHours:[8,20],
    head:0xD8B8A0, body:0x8AA0B5, home:[-234,237.5], work:[-234,237.5], patrolRadius:0,
    dialog:[
      { text:'「咕——啊，那是欢迎的意思。微光镇鸽咖，鸽子管打招呼，我管收拾。」', options:[
        { text:'猫咖之后开的？', next:1 },
        { text:'鸽子会飞走吗？', next:2 },
        { text:'（咕回去）', next:3 },
      ]},
      { text:'「对，猫咖的接班店。猫管治愈，鸽子管陪伴——它们不粘人，但永远在檐下咕咕，像屋里有人。」', options:[
        { text:'鸽子会飞走吗？', next:2 },
        { text:'下次去主城看看猫。', next:null },
      ]},
      { text:'「飞啊，天天飞。但天黑前一只不少地回檐下。鸽子不恋屋檐，恋的是——饭盆。」', options:[
        { text:'……很实在。', next:null },
      ]},
      { text:'「（鸽子歪头看你。看起来它对你的咕评价不错。）」', options:[
        { text:'（满意地离开）', next:null },
      ]},
    ],
  },
  {
    id:'yt2024-nightwatch', name:'夜灯巡夜人', role:'微光镇 · 夜灯巡夜人', core:false, spawnChance:1,
    behavior:'field', workHours:[20,6],
    head:0xD0C8C0, body:0x3A4A5A, home:[-215,250], work:[-215,250], patrolRadius:0,
    dialog:[
      { text:'「……你也睡不着？正好，一起走一段。夜里的小镇，路灯一盏一盏替月亮值班。」', options:[
        { text:'你每晚都巡？', next:1 },
        { text:'夜里有什么？', next:2 },
        { text:'（跟上）', next:null },
      ]},
      { text:'「都巡。灯泡坏了我换，猫头鹰叫了我应一声。有人说我像游荡的影子——影子哪有那么勤快。」', options:[
        { text:'夜里有什么？', next:2 },
        { text:'挺浪漫的。', next:null },
      ]},
      { text:'「微光。别镇的灯是亮的，我们镇的灯是暖的。走累的人半夜路过，看到一盏没灭的灯，就能再走一段。」', options:[
        { text:'这段路我陪你走。', next:null },
      ]},
    ],
  },
  {
    id:'yt2024-gatekeeper', name:'门卫老纪', role:'微光镇 · 实验园区门卫', core:false, spawnChance:1,
    behavior:'field', workHours:[6,18],
    head:0xC8A888, body:0x5A6A55, home:[-196,221.5], work:[-196,221.5], patrolRadius:0,
    dialog:[
      { text:'「站住——登记？哈哈，逗你的。实验园区南门，白天随便进，晚上别乱闯：玻璃房里通宵亮着，人家在做实验。」', options:[
        { text:'园里在做啥？', next:1 },
        { text:'看门无聊吗？', next:2 },
        { text:'（进园看看）', next:null },
      ]},
      { text:'「试对话的、试格子的、试样式的，一间屋一个题目。东西坏得多、成得少——但门卫的活儿就是等。等他们半夜出来，我给他们留门。」', options:[
        { text:'留门算功劳吗？', next:2 },
        { text:'真有耐心。', next:null },
      ]},
      { text:'「算。去年有间玻璃房连亮了四十天，出来那天小伙子跟我说『成了』——我什么都没干，就门留了四十天。微光镇的道理：灯不灭，就有人接着走。」', options:[
        { text:'借你吉言。', next:null },
      ]},
    ],
  },
  // ── 2025 长风镇 ×3：年度作品公示 → 公展评审员；别看作者名称 → 无名店主；
  //    港区泊位 → 调度员 ──
  {
    id:'yt2025-inspector', name:'公展评审员', role:'长风镇 · 年度公展评审员', core:false, spawnChance:1,
    behavior:'field', workHours:[9,17],
    head:0xE3B7A0, body:0x5A7A8A, home:[-235.3,282.1], work:[-235.3,282.1], patrolRadius:0,
    dialog:[
      { text:'「长风镇公展，每年一届。今年的名单刚挂上桅杆——从两百多件里挑出来的，风都吹不动的那种好。」', options:[
        { text:'怎么挑的？', next:1 },
        { text:'今年头名是什么？', next:2 },
        { text:'（看桅杆上的名单）', next:null },
      ]},
      { text:'「三个字：留得住。热度会退，跟风会散，能留下来的作品，隔年回看还站得住——就是它了。」', options:[
        { text:'头名是什么？', next:2 },
        { text:'也想被留下一回。', next:null },
      ]},
      { text:'「一份讲『运动』的实验记录。名字我不能剧透——公展的规矩，头名要自己去看。坐环线车去，下一站就到。」', options:[
        { text:'这就去。', next:null },
      ]},
    ],
  },
  {
    id:'yt2025-shopkeeper', name:'无名店主', role:'长风镇 · 无名店主', core:false, spawnChance:1,
    behavior:'field', workHours:[10,19],
    head:0xC0A890, body:0x6A6A5A, home:[-242.6,277], work:[-242.6,277], patrolRadius:0,
    dialog:[
      { text:'「别看招牌，也别问我名字。店在这儿，东西在架上，你想要什么自己认。」', options:[
        { text:'为什么不能看？', next:1 },
        { text:'这卖的是什么？', next:2 },
        { text:'（看了眼招牌）', next:3 },
      ]},
      { text:'「看名字你会先想『他是谁』；不看名字，你才会想『这是什么』。这店里最重要的东西，都不挂在名字底下——主城那家饭店的老板娘也懂这个。」', options:[
        { text:'那挂在什么底下？', next:2 },
        { text:'有点意思。', next:null },
      ]},
      { text:'「挂在架子上。风铃、旧船票、没写完的信——每一件背后都有个故事，故事的作者不说，就都归长风。」', options:[
        { text:'我认一样。', next:null },
      ]},
      { text:'「（你瞄了一眼招牌——它好像自己动了，一个字都读不清。店主没回头，但笑了。）」', options:[
        { text:'……当我没看。', next:null },
      ]},
    ],
  },
  {
    id:'yt2025-dispatcher', name:'调度阿汀', role:'长风镇 · 港区调度员', core:false, spawnChance:1,
    behavior:'field', workHours:[8,20],
    head:0xE0B890, body:0x4A5A7A, home:[-258,275], work:[-258,275], patrolRadius:0,
    dialog:[
      { text:'「西边泊位后场归我排班。哪条船几点进、几点装、几点走，板上一笔一笔写着——长风镇的风大，排班得比风还稳。」', options:[
        { text:'今天什么班？', next:1 },
        { text:'风也会捣乱？', next:2 },
        { text:'（看排班板）', next:null },
      ]},
      { text:'「会。旗子一歪我就知道要变天——所以你看到泊位后场那面风旗了吗？它比天气预报诚实。旗子往哪倒，船就往哪让。」', options:[
        { text:'船也听旗的？', next:2 },
        { text:'真厉害。', next:null },
      ]},
      { text:'「不听旗的船，都停在礁石上了。这行干久了就明白：跑得快不算本事，回得来才算。跟你们写东西的一个道理——发得快不算，留得住才算。」', options:[
        { text:'（记下了）', next:null },
      ]},
    ],
  },
  // ── 2026 星港 ×4：API事件纪念碑 → 守碑员；物实之辉周刊 → 排字工；
  //    夜市街 → 摊主与说书人 ──
  {
    id:'yt2026-monumentkeeper', name:'守碑员', role:'星港 · 守碑员', core:false, spawnChance:1,
    behavior:'field', workHours:[0,24],
    head:0xD6B2A0, body:0x4A5A6A, home:[-182.7,254.1], work:[-182.7,254.1], patrolRadius:0,
    dialog:[
      { text:'「欢迎来星港。碑在前面，我守着它——这是全岛最新的伤疤，也是最硬的一课。」', options:[
        { text:'碑上记着什么？', next:1 },
        { text:'守碑做什么？', next:2 },
        { text:'（去碑前看看）', next:null },
      ]},
      { text:'「那年春天，有人用歪路子刷热度——评论、支持、观看，全成了数字游戏。碑立起来，不为记恨谁，为让后来的人路过时想一秒：数据是真的，才算数。」', options:[
        { text:'守碑做什么？', next:2 },
        { text:'一秒够了。', next:null },
      ]},
      { text:'「擦字。字不能糊。日子太平的时候没人看我；哪天有人又想走歪路，回头看一眼碑还在——就够了。」', options:[
        { text:'碑会一直在。', next:null },
      ]},
    ],
  },
  {
    id:'yt2026-typesetter', name:'排字工', role:'星港 · 星辉周刊排字工', core:false, spawnChance:1,
    behavior:'field', workHours:[14,23],
    head:0xC89973, body:0x3A5A7A, home:[-182.7,269.7], work:[-182.7,269.7], patrolRadius:0,
    dialog:[
      { text:'「截稿前两小时，别催。星辉周刊——星港每周一次的灯火汇编，我是让字排队的人。」', options:[
        { text:'本周头条是什么？', next:1 },
        { text:'『星辉』是什么意思？', next:2 },
        { text:'（不打扰了）', next:null },
      ]},
      { text:'「头条天天换：新实验、新晋的作者、吵翻天的讨论。还有位作者，每期只寄一张封面来，别的什么都不写——排字工最怕这种神秘人。」', options:[
        { text:'『星辉』是什么意思？', next:2 },
        { text:'给我留一份。', next:3 },
      ]},
      { text:'「每颗星只亮一下，但一片天亮成破晓。周刊就是把那些一下、一下，攒成一页——攒到天亮，就是物实之辉。」', options:[
        { text:'给我留一份。', next:3 },
        { text:'说得好。', next:null },
      ]},
      { text:'「（他从油墨未干的纸堆里抽出一份，塞给你。）拿好，头版还热着。下周五出下一期——星港的规矩，说到就到。」', options:[
        { text:'下周五见。', next:null },
      ]},
    ],
  },
  {
    id:'yt2026-stallkeeper', name:'炭火老周', role:'星港 · 夜市摊主', core:false, spawnChance:1,
    behavior:'field', workHours:[17,2],
    head:0xC68642, body:0x6A4A3A, home:[-241,332], work:[-241,332], patrolRadius:0,
    dialog:[
      { text:'「夜市往南，灯最密的那条街谷。我的摊子在最深处——炭火不旺的地方，客人反而不请自来。」', options:[
        { text:'卖什么？', next:1 },
        { text:'为什么开在最里面？', next:2 },
        { text:'（晚上再来）', next:null },
      ]},
      { text:'「烤串、烤饼、烤年糕，一句话：万物皆可炭。白天备料，傍晚生火，后半夜收摊——星港的夜比白天长，夜市就是这条街的心跳。」', options:[
        { text:'心跳跳到几点？', next:2 },
        { text:'听饿了。', next:null },
      ]},
      { text:'「跳到最后一炉炭灭。末班车走之前，我给夜班的人留一串免费的——他们守这座城的灯，我守他们的胃。街谷里那两道灯串，就是我挂的，让晚归的人远远看见：还开着。」', options:[
        { text:'（晚上一定来）', next:null },
      ]},
    ],
  },
  {
    id:'yt2026-raconteur', name:'说书柳先生', role:'星港 · 夜市说书人', core:false, spawnChance:1,
    behavior:'field', workHours:[19,1],
    head:0xE8C4A0, body:0x3A4A5A, home:[-352,341], work:[-352,341], patrolRadius:0,
    dialog:[
      { text:'「今晚开讲得早——你来得巧，正说到环线通车那一段。找个位置站好，故事不要钱，掌声随缘。」', options:[
        { text:'讲的什么？', next:1 },
        { text:'（坐下听）', next:2 },
        { text:'（赶时间）', next:null },
      ]},
      { text:'「讲这座城。从第一盏灯讲到磁悬列车，从两栋屋讲到夜市的千百个摊位。别处的说书人讲才子佳人，我讲灯——每一年，这座城都添了一种新的灯。」', options:[
        { text:'最喜欢哪一盏？', next:2 },
        { text:'明天还有吗？', next:null },
      ]},
      { text:'「最南边那座终章塔顶上，有一盏至今没亮的。他们说，那是留给明年的。我讲到这里就收场——后面的故事，得等下一年的人来讲。」', options:[
        { text:'（望向塔顶的灯）', next:null },
      ]},
    ],
  },
];
