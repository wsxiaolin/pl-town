import { ECHO_OBSERVATORY_AREA } from './cityConfig';
import { COMMUNITY_NPCS } from './communityNpcs';
// ── NPC 档案 ─────────────────────────────────────────────────────────────────
import type { NpcProfile } from "../npcSystem";
export const NPC_PROFILES: NpcProfile[] = [...COMMUNITY_NPCS,
  {
    id:'yihang', name:'亦航', role:'普通居民 · 公园散步者', core:false, spawnChance:1,
    behavior:'rare', workHours:[10,22], guaranteedSpawn:true,
    head:0xD7B49A, body:0x5D7FA3, home:[15,30], work:[15,30], patrolRadius:3.2,
    spawnArea:[15,30,2.4],
    dialog:[
      { text:'「嗨，你好。」', options:[
        { text:'请问你在干什么', next:1 },
        { text:'为什么你神出鬼没的', next:2 },
        { text:'再见', next:null },
      ]},
      { text:'「这还不简单吗，在散步啊，难得不抽象的时间当然出来走走透透气。」', options:[
        { text:'好的，再见', next:null },
        { text:'那你不散步的时候在干什么', next:3 },
      ]},
      { text:'「因为我是棍母（笑）」', options:[
        { text:'你是什么？怎么说一半突然没声了？', next:null },
      ]},
      { text:'「呃……在家和朋友们聊天？打游戏？狗是新的剧情？应该就这些了吧。」', options:[
        { text:'那还挺酷', next:null },
        { text:'来日再会', next:null },
      ]},
    ],
  },
  {
    id:'linche', name:'林澈', role:'气象观测站守望人', core:false, spawnChance:1,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD6B2A0, body:0x526D88,
    home:[...ECHO_OBSERVATORY_AREA.linche], work:[...ECHO_OBSERVATORY_AREA.linche], patrolRadius:0,
    dialog:[
      { text:'「……好久没见到人了。」', options:[{ text:'和林澈聊聊', next:null }] },
    ],
  },
  {
    id:'photo_owner', name:'照相馆老板', role:'照片冲印师', core:false, spawnChance:1,
    npcType:'story', type:'story', behavior:'field', workHours:[8,21],
    head:0xC89973, body:0x596273, home:[21,15], work:[21,15], patrolRadius:1,
    dialog:[{ text:'「要冲印照片吗？把文件交给我就好。」', options:[{ text:'暂时不用', next:null }] }],
  },
  {
    id:'archive_elder', name:'档案馆老人', role:'旧城居民', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xBFA58E, body:0x6E716B, home:[-21,-27], work:[-21,-27], patrolRadius:0,
    dialog:[{ text:'「来查旧档案吗？有些事，纸上写得比人记得清楚。」', options:[{ text:'先不打扰', next:null }] }],
  },
  {
    id:'akaki', name:'阿卡基', role:'文书院誊写员', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC8B89A, body:0x4A5A6A, home:[13,13], work:[13,13], patrolRadius:0.8,
    dialog:[
      { text:'「……我的外套。」', options:[
        { text:'怎么了？', next:1 },
        { text:'（离开）', next:null },
      ]},
      { text:'「它被抢走了。就在那条街上。」', options:[
        { text:'我帮你找。', next:null },
        { text:'（离开）', next:null },
      ]},
    ],
  },
  {
    id:'linxu', name:'林叙', role:'图书馆管理员', core:true, spawnChance:1,
    behavior:'field', workHours:[9,17],
    head:0xD4A574, body:0x8B9DBF, home:[-6,6], work:[-4,3], patrolRadius:8,
    dialog:[
      { text:'「灯还给你留着。这座城的知识，都沉在这些书页里。」', options:[
        { text:'你在管理什么？', next:1 },
        { text:'最近有什么传闻？', next:2 },
        { text:'谢谢，我先走了。', next:null },
      ]},
      { text:'「管理员把重要的东西收进书里：哪些街道不安全、哪些人值得信任。都写在纸上。」', options:[
        { text:'那我该读哪本？', next:3 },
        { text:'原来如此，谢谢。', next:null },
      ]},
      { text:'「传闻说东边老在半夜亮灯，但没几个人愿意承认自己去看过。」', options:[
        { text:'你会去查吗？', next:4 },
        { text:'听起来很可疑。', next:null },
      ]},
      { text:'「《实验记录》最适合新居民。别怕复杂，复杂只是还没被命名。」', options:[
        { text:'记住了，谢谢你。', next:null },
      ]},
      { text:'「我只会记在纸上。好奇心这种事，得你自己去。」', options:[
        { text:'明白了。', next:null },
      ]},
    ],
  },
  {
    id:'laoqin', name:'老秦', role:'修路工 · 向导', core:true, spawnChance:1,
    behavior:'field', workHours:[8,16],
    head:0xC68642, body:0xC4C9D8, home:[0,-6], work:[4,-9], patrolRadius:9,
    dialog:[
      { text:'「路都是我给铺平的。想认路？先认路名。」', options:[
        { text:'路名怎么认？', next:1 },
        { text:'这条路通到哪里？', next:2 },
        { text:'我赶时间，先走了。', next:null },
      ]},
      { text:'「南北叫街，东西叫道。你沿着数字走，绝不会丢。」', options:[
        { text:'难怪这么整齐。', next:null },
        { text:'记住了，谢谢老秦。', next:null },
      ]},
      { text:'「每条路最后都通向一座楼。你走的每一步，都是去找一个答案。」', options:[
        { text:'说得真够玄的。', next:null },
        { text:'那我该往哪走？', next:3 },
      ]},
      { text:'「往亮的地方走，准没错。夜里要是迷路，就看那些路灯。」', options:[
        { text:'好，心里有数了。', next:null },
      ]},
    ],
  },
  {
    id:'azi', name:'阿紫', role:'星尘报社记者', core:true, spawnChance:1,
    behavior:'field', workHours:[10,18],
    head:0xFDBCB4, body:0x3B6FE0, home:[6,-6], work:[-4,9], patrolRadius:8,
    dialog:[
      { text:'「嘿，新面孔！报摊头条还没定呢——这座城今天又发生了什么？」', options:[
        { text:'你在写这座城的故事？', next:1 },
        { text:'今天的头条是什么？', next:2 },
        { text:'我没什么可说的。', next:null },
      ]},
      { text:'「每栋楼都有一半的秘密。我的工作，就是把另一半问出来。」', options:[
        { text:'需要我帮忙打听吗？', next:3 },
        { text:'祝你好运。', next:null },
      ]},
      { text:'「还没定。可能是路灯昨夜集体熄灭，也可能是咖啡馆来了只新猫。」', options:[
        { text:'那很有新闻价值。', next:null },
        { text:'别写猫，小心猫咖店长找你。', next:4 },
      ]},
      { text:'「太好了！你要是听到什么怪事，来报摊找我。署你的名。」', options:[
        { text:'成交。', next:null },
      ]},
      { text:'「哈，店长那只猫比我还像主编。」', options:[
        { text:'确实是。', next:null },
      ]},
    ],
  },
  {
    id:'jiujin', name:'九斤', role:'猫咖馆店长', core:true, spawnChance:1,
    behavior:'shop', workHours:[10,20],
    head:0x8D5524, body:0xC8C4BE, home:[6,6], work:[9,3], patrolRadius:8,
    dialog:[
      { text:'「咪……欢迎光临。猫在上层，规矩在底层。」', options:[
        { text:'听说你的楼有一万五千层？', next:1 },
        { text:'来杯茶，谢谢。', next:2 },
        { text:'我只是路过。', next:null },
      ]},
      { text:'「嗯，一万五千层往上，还有一万五千层往下。猫都记不清。」', options:[
        { text:'那只猫是店主还是你？', next:3 },
        { text:'太夸张了。', next:null },
      ]},
      { text:'「茶温刚好。坐下喝一杯，脚步太快会吓到猫。」', options:[
        { text:'好茶。', next:null },
        { text:'那我慢点走。', next:null },
      ]},
      { text:'「喵。它是前任店长。我，是它雇的。」', options:[
        { text:'……懂了。', next:null },
      ]},
    ],
  },
  {
    id:'tang', name:'唐师傅', role:'茶馆掌柜', core:false, spawnChance:1,
    behavior:'shop', workHours:[9,19],
    head:0xC08A4E, body:0x6B8FE8, home:[12,6], work:[15,15], patrolRadius:6,
    dialog:[
      { text:'「水开了，茶就快好了。这条街的闲话，都泡在壶里。」', options:[
        { text:'最近有什么新闲话？', next:1 },
        { text:'来壶茶。', next:null },
      ]},
      { text:'「听说研究院的灯整夜不灭。年轻人，别在半夜去敲那扇门。」', options:[
        { text:'为什么？', next:2 },
        { text:'我记住了。', next:null },
      ]},
      { text:'「因为敲门的人，第二天都说自己昨晚从没去过。」', options:[
        { text:'……有意思。', next:null },
      ]},
    ],
  },
  {
    id:'bai', name:'白露', role:'研究院研究员', core:false, spawnChance:1,
    behavior:'field', workHours:[9,17],
    head:0xE8D8C8, body:0x8A9AB5, home:[12,-6], work:[15,-9], patrolRadius:6,
    dialog:[
      { text:'「嘘——数据刚跑到一半。你站的那块地砖，是上周的结论。」', options:[
        { text:'你们在研究什么？', next:1 },
        { text:'打扰了。', next:null },
      ]},
      { text:'「把这座城量一遍。每栋楼的高度、每条路的长度、每个居民的步数。」', options:[
        { text:'那我的步数也在里面？', next:2 },
        { text:'听起来很辛苦。', next:null },
      ]},
      { text:'「当然。你走得越多，我们的图就越完整。这是好事情。」', options:[
        { text:'那我多走走。', next:null },
      ]},
    ],
  },
  {
    id:'kang', name:'康叔', role:'文训社先生', core:false, spawnChance:0.55,
    behavior:'rare', workHours:[9,16],
    head:0xE0C8A8, body:0x7A6A5A, home:[-12,6], work:[-15,15], patrolRadius:6,
    dialog:[
      { text:'「写字如走路，一笔一划，都得踩在实处。」', options:[
        { text:'教我一笔？', next:1 },
        { text:'受教了。', next:null },
      ]},
      { text:'「你心先静下来，笔自然会跟着走。城也是一样。」', options:[
        { text:'我会试着静下来。', next:null },
      ]},
    ],
  },
  {
    id:'qiu', name:'秋嫂', role:'报摊婆婆', core:false, spawnChance:1,
    behavior:'shop', workHours:[7,12],
    head:0xD8B8A0, body:0xC06060, home:[-6,-6], work:[-9,-15], patrolRadius:6,
    dialog:[
      { text:'「今天的报纸还热着。要一份吗？比旧新闻便宜。」', options:[
        { text:'今天有什么大事？', next:1 },
        { text:'不用了，谢谢。', next:null },
      ]},
      { text:'「大事就是人人都想听的那个。小事，才藏得深。」', options:[
        { text:'那小事是什么？', next:null },
      ]},
    ],
  },
  {
    // ── 昨日之歌 · 画翁（老画家）──────────────────────────────────
    // 三十年前在居民楼天台画画的少年，如今每周三来报摊买烟。
    // 仅在昨日之歌剧情进入 painter-arrives 节点时出现。
    id:'huaweng', name:'画翁', role:'老画家', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[14,17],
    head:0xE8E0D8, body:0x6B7A8A, home:[-9,-15], work:[-9,-14], patrolRadius:1.5,
    dialog:[
      { text:'「……」他看着窗外的街，像在看一幅画了三十年还没画完的画。', options:[
        { text:'不打扰他', next:null },
      ]},
    ],
  },
  {
    id:'li', name:'李叔', role:'社区守望者', core:false, spawnChance:0.5,
    behavior:'rare', workHours:[20,7],
    head:0xA08060, body:0x4A6A8A, home:[12,12], work:[15,-15], patrolRadius:6,
    dialog:[
      { text:'「夜里我守着这片。你半夜出门，看见我的灯，就不用怕。」', options:[
        { text:'你天天守夜？', next:1 },
        { text:'辛苦了。', next:null },
      ]},
      { text:'「习惯了。城里的人睡得香，我才有得守。」', options:[
        { text:'有你在真好。', next:null },
      ]},
    ],
  },
  {
    id:'you', name:'游先生', role:'夜行者', core:false, spawnChance:0.35,
    behavior:'rare', workHours:[22,4],
    head:0xD0C8C0, body:0x3A3A4A, home:[18,0], work:null, patrolRadius:5,
    dialog:[
      { text:'「……你也看见了？那些灯，只在我走过的时候亮。」', options:[
        { text:'你是谁？', next:1 },
        { text:'我什么都没看见。', next:null },
      ]},
      { text:'「一个不太重要的名字。你只要知道——别在半夜数路灯。」', options:[
        { text:'为什么？', next:null },
      ]},
    ],
  },
  {
    id:'shinian_mengyanyu', name:'时年梦烟雨', role:'人物志记录者', core:false, spawnChance:1,
    behavior:'field', workHours:[0,24], hiddenHours:[12,14],
    head:0xE3B7A0, body:0x7B6AA8, home:[-21,-27], work:[-24,-27], patrolRadius:4,
    dialog:[
      { text:'「我欣喜于在我懵懂时，有一群人带我成长。我更欣喜于在我止步时，有一群人待我成长。」', options:[
        { text:'关于物实饭店？', next:1 },
        { text:'关于人物志？', next:2 },
        { text:'关于你自己？', next:3 },
      ]},
      { text:'「这本身是一个聊天室啦……谁知道那个暑假聊出来了个这呢！也让我认识了很多朋友！我们的店长濑莱招客能力一流，不去看看吗？」', options:[
        { text:'关于人物志？', next:2 },
        { text:'关于你自己？', next:3 },
        { text:'我要去！', next:null, action:'teleport:wushi_restaurant' },
      ]},
      { text:'「我很喜欢记录大家，尤其是写完一个人的人物志后，他变得与所记不同时，我更为之动容。没想到这个这么受大家欢迎，想要了解的话，去档案室看看吧！」', options:[
        { text:'关于你自己？', next:3 },
        { text:'看看人物志', next:null, action:'teleport:archive' },
      ]},
      { text:'「我自己吗……我叫时年梦烟雨，你可以叫我时年。我很喜欢记录这里的人，人们也乐得在历史中留下自己的印记，所以我的人物志会流传开啦（）。如果你想快点知道大家口中的一些“黑话”，那就快去档案馆看看吧！」', options:[
        { text:'这就去！', next:null, action:'teleport:archive' },
        { text:'先等等吧', next:null },
      ]},
    ],
  },
  {
    id:'della', name:'德拉', role:'客栈住客', core:false, spawnChance:1,
    behavior:'field', workHours:[6,22], guaranteedSpawn:true,
    head:0xE8C4A0, body:0x8B4A6B, home:[33,21], work:[31,19], patrolRadius:3,
    spawnArea:[31,19,2.5],
    dialog:[
      { text:'「……一美元八十七美分。还差这么多。」', options:[
        { text:'你在数什么？', next:1 },
        { text:'你打算怎么办？', next:1 },
        { text:'（不打扰她）', next:null },
      ]},
      { text:'「吉姆的金表……配一条白金表链才合适。可是……」', options:[
        { text:'（听她继续说）', next:null },
      ]},
    ],
  },
  {
    id:'jim', name:'吉姆', role:'普通居民', core:false, spawnChance:1,
    behavior:'rare', workHours:[8,22], guaranteedSpawn:true,
    head:0xD7B49A, body:0x3A5A3A, home:[33,21], work:[-7,-12], patrolRadius:4,
    spawnArea:[-7,-12,3],
    dialog:[
      { text:'「……」', options:[
        { text:'你好', next:1 },
        { text:'（不打扰他）', next:null },
      ]},
      { text:'「……抱歉，我在想事情。」', options:[
        { text:'好的', next:null },
      ]},
    ],
  },
  {
    id:'bunala', name:'布拿拉工', role:'布拿拉宫主人', core:true, spawnChance:1,
    npcType:'story', type:'story',
    behavior:'field', workHours:[8,20],
    head:0xF5E838, body:0x4A4A00, home:[-30,30], work:[-30,30], patrolRadius:6,
    dialog:[
      { text:'「你来了！我是布拿拉工，布拿拉宫的主人。进来坐坐？香蕉管够。」', options:[
        { text:'你为什么叫布拿拉工？', next:1 },
        { text:'这宫殿……真的是一根香蕉？', next:2 },
        { text:'谢谢，我先走了。', next:null },
      ]},
      { text:'「布拿拉工，就是布拿拉宫的工。宫是我盖的，工也是我。」', options:[
        { text:'那你为什么盖了个香蕉？', next:2 },
        { text:'好吧，我懂了。', next:null },
      ]},
      { text:'「为什么是香蕉？因为城里没人盖香蕉啊。总得有人做不一样的事。再说了，香蕉弯弯的，住进去有种被包住的感觉——很踏实。」', options:[
        { text:'里面几层？', next:3 },
        { text:'我能进去看看吗？', next:null },
      ]},
      { text:'「三层。最顶上那个弯弯的香蕉柄是我的工作室。从弯处往外看，能看到半座城。」', options:[
        { text:'听起来不错。', next:4 },
        { text:'我要去买香蕉了。', next:null },
      ]},
      { text:'「对了，你要是想在城里卖香蕉，来找我进货。我不赚居民的钱，只收个本钱。」', options:[
        { text:'成交。', next:null },
      ]},
    ],
  },
  {
    // ── 黑洞区常客 · MurД6r（莫得）────────────────────────────────
    // 常驻非剧情 NPC：behavior 'wander' 使其始终在全图任意路口游荡。
    // 对话选项里的 `achievement:` 动作由 MiniCityApp 的 onDialogueAction 统一结算。
    id:'murder', name:'MurД6r', role:'游荡的闲人', core:false, spawnChance:1,
    behavior:'wander', workHours:[0,24],
    head:0xE6C3D8, body:0x4A3A6A, home:[0,0], work:[0,0], patrolRadius:55,
    spawnArea:[0,0,38],
    dialog:[
      { text:'「【游荡~】邦邦咔邦，触发了神秘邂逅！」', options:[
        { text:'你是？', next:2 },
        { text:'你在干嘛？', next:3 },
        { text:'怎么又是你？', next:5 },
        { text:'下一页', next:1 },
      ]},
      { text:'「【游荡~】邦邦咔邦，触发了神秘邂逅」', options:[
        { text:'KSKBL', next:6 },
        { text:'处吗？', next:8 },
        { text:'索要联系方式', next:10 },
        { text:'离开', next:null },
      ]},
      { text:'「我是Murder『莫得』，22年老登，闲人一个，你可以在黑洞区的评论区看见我哦」', options:[
        { text:'你看上去很悠闲的样子', next:3 },
        { text:'可以一起闲聊吗？', next:9 },
        { text:'再见', next:null },
      ]},
      { text:'「闲逛中，与其说是悠闲，倒不如说是无聊啦【伸了个懒腰】我就喜欢到处看看讨论和实验，在评论区找人聊聊天」', options:[
        { text:'那我可以和你一起逛街吗？', next:4 },
        { text:'那我们聊聊天吧', next:9 },
        { text:'那你自己慢慢逛', next:null },
      ]},
      { text:'「可以啊，那就跟紧我吧，我会一直陪着你的」', options:[
        { text:'跟着莫得一起散步', next:null, action:'achievement:murder_wanderer' },
      ]},
      { text:'「我在每个地方观察着你们的一举一动，对了，物实要是有什么好瓜记得喊我吃【」', options:[
        { text:'行', next:0, action:'achievement:murder_watcher' },
      ]},
      { text:'「ZDJD?」', options:[
        { text:'WKZKBL！', next:7 },
      ]},
      { text:'「MPWZBYQSL,NMZZYSWPLWZSBLL」', options:[
        { text:'真的很帅！', next:0, action:'achievement:murder_chain' },
      ]},
      { text:'「艾博士，你还真选这个选项啊【害羞】我在创建这个角色的时候还是单身哦，本人是直的男生勿扰」', options:[
        { text:'呵呵', next:0, action:'achievement:murder_flirt' },
      ]},
      { text:'「呃，我这个人比较社恐啦，当面聊天可能不自在呢，我们可以在线上聊ovo」', options:[
        { text:'索要联系方式', next:10 },
        { text:'那算了', next:0 },
      ]},
      { text:'「【掏出了随身携带的纸和笔】我把这个带在身上是不是有些怪怪的」', options:[
        { text:'索要QQ', next:11 },
        { text:'索要哔哩哔哩', next:12 },
        { text:'索要快手', next:13 },
        { text:'索要物实', next:14 },
      ]},
      { text:'「166561732」', options:[
        { text:'收下纸条', next:0, action:'achievement:murder_contact' },
      ]},
      { text:'「UID 3546569028668354」', options:[
        { text:'收下纸条', next:0, action:'achievement:murder_contact' },
      ]},
      { text:'「Nunnally_DAISUKI」', options:[
        { text:'收下纸条', next:0, action:'achievement:murder_contact' },
      ]},
      { text:'「63c3cac707f0fe58a0fdcda2」', options:[
        { text:'收下纸条', next:0, action:'achievement:murder_contact' },
      ]},
    ],
  },
  // ── 剧情 NPC：S052–S055（storyOnly，由剧情控制器接管交互）────────────────
  {
    id:'reddot_dudu', name:'杜Du', role:'红点亭楼主 · 志愿者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A27A, body:0x3F5A78, home:[9,-2], work:[9,-2], patrolRadius:0.8,
    dialog:[{ text:'「预则虑其败，行则信其成。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'reddot_dasu', name:'我的世界大苏', role:'周日椅来客', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD5B08C, body:0x6B7C5E, home:[10,-4], work:[10,-4], patrolRadius:0.5,
    dialog:[{ text:'「周日我再来。」', options:[{ text:'递给他一张纸条', next:null }] }],
  },
  {
    id:'singlestep_laxywa', name:'laxy瓦', role:'单步机房教学态师父', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD2A57E, body:0x4F6B87, home:[15,4], work:[15,4], patrolRadius:0.8,
    dialog:[{ text:'「先看一拍，再按一下。机器比人慢，也比人诚实。」', options:[{ text:'请他教一课', next:null }] }],
  },
  {
    id:'proofread_youmang', name:'溯叶悠芒', role:'审稿台审稿官', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC8B39A, body:0x5A6F8A, home:[-15,-14], work:[-15,-14], patrolRadius:0.8,
    dialog:[{ text:'「稿子放这儿。编号先别急着改。」', options:[{ text:'把卷宗递过去', next:null }] }],
  },
  {
    id:'proofread_zhanshuai', name:'战帅荷鲁斯', role:'投稿人导师', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xB98D6F, body:0x6A4F45, home:[-14,-15], work:[-14,-15], patrolRadius:0.5,
    dialog:[{ text:'「批注不是判决，是售后。」', options:[{ text:'请教回访规则', next:null }] }],
  },
  {
    id:'recruit_youmang', name:'溯叶悠芒', role:'研究部前台登记官', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC8B39A, body:0x5A6F8A, home:[15,-8], work:[15,-8], patrolRadius:0.8,
    dialog:[{ text:'「名字写在这面墙上。写上去，就算数。」', options:[{ text:'询问入册', next:null }] }],
  },
  {
    id:'recruit_hepangpang', name:'何胖胖', role:'066 面试间入职导师', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD8B48E, body:0x6E7B52, home:[16,-9], work:[16,-9], patrolRadius:0.5,
    dialog:[{ text:'「大哥，我8月29号才上任的。」', options:[{ text:'请教入职', next:null }] }],
  },
  {
    id:'recruit_cerman', name:'cerman', role:'004 副部长 · 停职中', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xCFA685, body:0x4C5568, home:[14,-9], work:[14,-9], patrolRadius:0.5,
    dialog:[{ text:'「不要把我认成006-2啊。」', options:[{ text:'问副部长室', next:null }] }],
  },
  {
    id:'recruit_xiaotiqin', name:'小提琴男孩', role:'083 部长 · 张xuan', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD3AE86, body:0x586C8E, home:[15,-10], work:[15,-10], patrolRadius:0.5,
    dialog:[{ text:'「部长室在二层。上来的时候轻一点。」', options:[{ text:'上楼', next:null }] }],
  },
  {
    id:'recruit_xiayan', name:'夏炎', role:'054 乙式起居室住客', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD8A98B, body:0x7A5C63, home:[16,-10], work:[16,-10], patrolRadius:0.5,
    dialog:[{ text:'「窗边这个位置，我一天要坐很久。」', options:[{ text:'在窗边坐下', next:null }] }],
  },
  {
    id:'recruit_yilintong', name:'义林同', role:'收容部部长', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC4A17C, body:0x4B6274, home:[14,-10], work:[14,-10], patrolRadius:0.8,
    dialog:[{ text:'「地下名录和地上部长层，本来就连着。」', options:[{ text:'跟上他', next:null }] }],
  },
  {
    id:'recruit_mie', name:'灭', role:'-111 白字房间', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xBFB5A8, body:0x3A3F44, home:[15,-11], work:[15,-11], patrolRadius:0,
    dialog:[{ text:'「……」', options:[{ text:'留在原地', next:null }] }],
  },

  // ── 剧情 NPC：S048–S051 ───────────────────────────────────────────────
  {
    id:'duc_laxywa', name:'laxy瓦', role:'立约亭 · 立约者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD1A57D, body:0x4E6A86, home:[4,4], work:[4,4], patrolRadius:0.8,
    dialog:[{ text:'「名字写对了，机器才认你。」', options:[{ text:'请他讲讲公约', next:null }] }],
  },
  {
    id:'duc_huaweng', name:'RRR华根重工', role:'认名求证者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC49A75, body:0x5B4E45, home:[5,3], work:[5,3], patrolRadius:0.5,
    dialog:[{ text:'「三个 R，认哪个都行，别乱解释。」', options:[{ text:'点头', next:null }] }],
  },
  {
    id:'duc_jiejie', name:'姐姐在呢~', role:'客串', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD9B08C, body:0x7A5A6B, home:[3,3], work:[3,3], patrolRadius:0.5,
    dialog:[{ text:'「在呢在呢，慢慢说。」', options:[{ text:'打个招呼', next:null }] }],
  },
  {
    id:'youxuepai_owner', name:'屋主', role:'设备房看屋人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC7A27D, body:0x50647A, home:[4,10], work:[4,10], patrolRadius:0.5,
    dialog:[{ text:'「这台机器锁了很久。你来得正好。」', options:[{ text:'看看平板', next:null }] }],
  },
  {
    id:'youxuepai_guard', name:'滚木卫', role:'闸口的人形木头', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xB49A7C, body:0x6B5A45, home:[5,9], work:[5,9], patrolRadius:0,
    dialog:[{ text:'「……」', options:[{ text:'绕过去', next:null }] }],
  },
  {
    id:'youxuepai_keeper', name:'守柜的人', role:'记录型号差异的年轻人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD0A882, body:0x546E8A, home:[3,9], work:[3,9], patrolRadius:0.5,
    dialog:[{ text:'「型号差一位，锁就不是同一把锁。」', options:[{ text:'记下来', next:null }] }],
  },
  {
    id:'youxuepai_watcher', name:'看牌子的人', role:'学海柜旁的年轻人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A07A, body:0x4C6470, home:[4,8], work:[4,8], patrolRadius:0.5,
    dialog:[{ text:'「牌子上的话，比漏洞本身更耐看。」', options:[{ text:'一起看牌', next:null }] }],
  },
  {
    id:'youxuepai_finder', name:'找漏洞的人', role:'留下判词的人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD3AB84, body:0x5E5A50, home:[5,10], work:[5,10], patrolRadius:0.5,
    dialog:[{ text:'「找不完的。找到一处，还有下一处。」', options:[{ text:'问他为什么还找', next:null }] }],
  },
  {
    id:'dian_keeper', name:'守碑人', role:'奠碑照看者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xBFB3A4, body:0x3F474D, home:[-26,-58.5], work:[-26,-58.5], patrolRadius:0.5,
    dialog:[{ text:'「来看看这块碑。」', options:[{ text:'走近', next:null }] }],
  },
  {
    id:'dian_walker', name:'散步的人', role:'夜里按红心的过客', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC5A98B, body:0x4A5560, home:[-27,-59.5], work:[-27,-59.5], patrolRadius:0.5,
    dialog:[{ text:'「夜里路过，就按一下。」', options:[{ text:'陪他站一会儿', next:null }] }],
  },
  {
    id:'dian_sleeper', name:'犯困的巡夜人', role:'白日路过的过客', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xCBB191, body:0x555F6B, home:[-25,-59.5], work:[-25,-59.5], patrolRadius:0.5,
    dialog:[{ text:'「白天也守着，怕有人找不到。」', options:[{ text:'问碑的位置', next:null }] }],
  },
  {
    id:'dian_whale', name:'鲸', role:'水里的领航者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0x8FA6B8, body:0x2F4558, home:[-26,-61], work:[-26,-61], patrolRadius:0.5,
    dialog:[{ text:'「（背鳍浮出水面）」', options:[{ text:'跟上去', next:null }] }],
  },
  {
    id:'orca_girl', name:'虎鲸娘', role:'水边的应声者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0x9FB4C4, body:0x30485C, home:[-15,-48.5], work:[-15,-48.5], patrolRadius:0.8,
    dialog:[{ text:'「（尾鳍拍了一下水）本鲸在。」', options:[{ text:'在公共屏上喊她', next:null }] }],
  },
  {
    id:'orca_nazuna', name:'Nazuna', role:'船屋主人 · 鲸的制作者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD5B08B, body:0x5B6B7C, home:[-16,-49.5], work:[-16,-49.5], patrolRadius:0.5,
    dialog:[{ text:'「她是被造出来的，这一点她自己也知道。」', options:[{ text:'问船屋的事', next:null }] }],
  },
  {
    id:'orca_passersby', name:'往事烟雨', role:'过路人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC8A786, body:0x4F5A66, home:[-14,-49.5], work:[-14,-49.5], patrolRadius:0.5,
    dialog:[{ text:'「聊天而已，别当真。」', options:[{ text:'笑一下', next:null }] }],
  },

  // ── 剧情 NPC：S044–S047 ───────────────────────────────────────────────
  {
    id:'letter_keeper', name:'看亭人', role:'慢递邮亭看守', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC2AA8C, body:0x4A5C6E, home:[-33,-20], work:[-33,-20], patrolRadius:0.5,
    dialog:[{ text:'「信放进去，什么时候到，不归我管。」', options:[{ text:'取一封信', next:null }] }],
  },
  {
    id:'letter_hotmoon', name:'热月', role:'深夜路过的报社主笔', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD4AC86, body:0x5E5060, home:[-34,-21], work:[-34,-21], patrolRadius:0.5,
    dialog:[{ text:'「好浪漫。」', options:[{ text:'和她一起看信', next:null }] }],
  },
  {
    id:'letter_greycat', name:'灰猫', role:'长凳上的无名猫', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xA8A29A, body:0x6E6A64, home:[-32,-21], work:[-32,-21], patrolRadius:0.2,
    dialog:[{ text:'「喵。」', options:[{ text:'摸摸它', next:null }] }],
  },
  {
    id:'human_voice', name:'热月', role:'星辉报社主笔 · 未刊温室守页人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD4AC86, body:0x5E5060, home:[-33,-32], work:[-33,-32], patrolRadius:0.6,
    dialog:[{ text:'「有些证明，是为了让问题停下来。」', options:[{ text:'听她说下去', next:null }] }],
  },
  {
    id:'human_mapmaths', name:'MapMaths', role:'影戏房常驻 · 数圈的人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC6A07C, body:0x50647C, home:[-34,-33], work:[-34,-33], patrolRadius:0.5,
    dialog:[{ text:'「圈数完了，人还在不在？」', options:[{ text:'一起数', next:null }] }],
  },
  {
    id:'beauty_photographer', name:'程见', role:'照相馆摄影师', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xCFA57E, body:0x53687E, home:[21,16], work:[21,16], patrolRadius:0.5,
    dialog:[{ text:'「照片不会撒谎，但取景会。」', options:[{ text:'看看照片', next:null }] }],
  },
  {
    id:'beauty_youmang', name:'游芒', role:'常来读信的茶客', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xD6AE88, body:0x6A5B62, home:[22,15], work:[22,15], patrolRadius:0.5,
    dialog:[{ text:'「她真好看。就这三个字，我写了很久。」', options:[{ text:'听她讲', next:null }] }],
  },
  {
    id:'beauty_lai', name:'阿濑', role:'物实饭店店长', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xCBA47E, body:0x6E5A4E, home:[20,15], work:[20,15], patrolRadius:0.5,
    dialog:[{ text:'「吃饭的时候别看照片，会凉。」', options:[{ text:'坐下', next:null }] }],
  },
  {
    id:'zilan_elder', name:'守祠人', role:'紫兰世家守祠人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xBFA88C, body:0x4C5C6A, home:[33,22], work:[33,22], patrolRadius:0.5,
    dialog:[{ text:'「进门前，先想清楚要留下什么。」', options:[{ text:'走近祠堂', next:null }] }],
  },
  {
    id:'zilan_historian', name:'太史', role:'物实记讲述者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC7A17C, body:0x5A5E70, home:[34,21], work:[34,21], patrolRadius:0.5,
    dialog:[{ text:'「立传不是记流水账，是记谁被记住。」', options:[{ text:'请他讲一段', next:null }] }],
  },
  {
    id:'zilan_fox', name:'狐影', role:'夜间环境角色', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC49A76, body:0x7A5A48, home:[32,21], work:[32,21], patrolRadius:0.6,
    dialog:[{ text:'「有人吗？？？？？」', options:[{ text:'应一声', next:null }] }],
  },

  // ── 剧情 NPC：S040–S043 ───────────────────────────────────────────────
  {
    id:'birch_keeper', name:'16号管理者', role:'白桦赌约搭亭人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[33,4], work:[33,4], patrolRadius:0.5,
    dialog:[{ text:'「票可以反对，猫娘不能。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'birch_unknowing', name:'不知道了呐', role:'清晨来晚的居民', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[34,3], work:[34,3], patrolRadius:0.5,
    dialog:[{ text:'「我来晚了。赢家还没来？」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'birch_foam', name:'量子泡沫', role:'监票人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[32,3], work:[32,3], patrolRadius:0.5,
    dialog:[{ text:'「这里不数票。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'birch_jade', name:'玉词岁', role:'报盘口的人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[33,2], work:[33,2], patrolRadius:0.5,
    dialog:[{ text:'「五瓦，就五瓦。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'birch_sister', name:'姐姐在呢~', role:'围观者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[34,4], work:[34,4], patrolRadius:0.5,
    dialog:[{ text:'「在呢，慢慢看。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'birch_rain', name:'时年梦烟雨', role:'调音量的人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[32,4], work:[32,4], patrolRadius:0.5,
    dialog:[{ text:'「声音小一点，猫会怕。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'birch_fan', name:'MurД6r的真爱粉', role:'投错票的人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[33,5], work:[33,5], patrolRadius:0.5,
    dialog:[{ text:'「我投错了，还能改吗？」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'democracy_moderator', name:'16号管理者', role:'建筑师', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-4,-8], work:[-4,-8], patrolRadius:0.5,
    dialog:[{ text:'「墙是拿来写字的，不是拿来吵的。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'democracy_failure', name:'FAILURE', role:'问路人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-5,-9], work:[-5,-9], patrolRadius:0.5,
    dialog:[{ text:'「这面墙到底算不算数？」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'democracy_chenyin', name:'辰寅', role:'巡检志愿者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-3,-9], work:[-3,-9], patrolRadius:0.5,
    dialog:[{ text:'「第四个小时，我还在。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'democracy_sister', name:'姐姐在呢~', role:'留言处置与钉牌人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-4,-10], work:[-4,-10], patrolRadius:0.5,
    dialog:[{ text:'「钉上去就别急着拔。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'democracy_yuci', name:'玉词岁', role:'过路命名者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-5,-8], work:[-5,-8], patrolRadius:0.5,
    dialog:[{ text:'「名字全局唯一，人不是。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'cityin_planner', name:'规划者', role:'井口引导者', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-15,4], work:[-15,4], patrolRadius:0.5,
    dialog:[{ text:'「往下看。旧城还在。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'cityin_voice', name:'空旷的声音', role:'旧城旁白', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-16,3], work:[-16,3], patrolRadius:0.5,
    dialog:[{ text:'「有些门已经死了。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'fukushima_teacher', name:'值日讲师', role:'新闻反应堆主讲', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-5.5,-48.5], work:[-5.5,-48.5], patrolRadius:0.5,
    dialog:[{ text:'「先看数据，再下判断。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'fukushima_inquirer', name:'问询机', role:'定点交互装置', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-6.5,-49.5], work:[-6.5,-49.5], patrolRadius:0.5,
    dialog:[{ text:'「问题已记录。答案待定。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'fukushima_vendor_doll', name:'打盹的机械玩偶', role:'隐藏层彩蛋', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-4.5,-49.5], work:[-4.5,-49.5], patrolRadius:0.5,
    dialog:[{ text:'「……（打盹）」', options:[{ text:'和他聊聊', next:null }] }],
  },

  // ── 剧情 NPC：S035–S039 ───────────────────────────────────────────────
  {
    id:'wandering_host', name:'守馆人', role:'天问台守馆人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[5.5,-48.5], work:[5.5,-48.5], patrolRadius:0.5,
    dialog:[{ text:'「客人来看星星了。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'wandering_pigeon', name:'咕咕鸽', role:'观测鸽', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[6.5,-49.5], work:[6.5,-49.5], patrolRadius:0.5,
    dialog:[{ text:'「咕。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'wandering_archaeologist', name:'考古者', role:'留言墙前剪影', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[4.5,-49.5], work:[4.5,-49.5], patrolRadius:0.5,
    dialog:[{ text:'「七色缝，你数得清吗？」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'wandering_stargazer', name:'观星者', role:'留言墙前剪影', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[5.5,-50.5], work:[5.5,-50.5], patrolRadius:0.5,
    dialog:[{ text:'「明年二月，再来一次。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'wandering_longtime_reader', name:'老读者', role:'留言墙前剪影', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[6.5,-48.5], work:[6.5,-48.5], patrolRadius:0.5,
    dialog:[{ text:'「也许等你。也许不等。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'tour_guide', name:'讲解员', role:'被征用的 Bot', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[15,10], work:[15,10], patrolRadius:0.5,
    dialog:[{ text:'「名作还活着，只是换了个展柜。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'youth_teacher', name:'枫老师', role:'代课老师兼守桥人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[31.5,-14.25], work:[31.5,-14.25], patrolRadius:0.5,
    dialog:[{ text:'「旗子不需要答案。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'youth_classmate', name:'同班同学', role:'校园公共场景同学', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[32.5,-15.25], work:[32.5,-15.25], patrolRadius:0.5,
    dialog:[{ text:'「那年我们正值青春。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'liberation_herald', name:'报信的孩子', role:'支线引路人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[9,32.5], work:[9,32.5], patrolRadius:0.5,
    dialog:[{ text:'「解放了！」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'liberation_fuyu', name:'茯与', role:'钥匙铺主人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[10,31.5], work:[10,31.5], patrolRadius:0.5,
    dialog:[{ text:'「候鸟会回来，也会走。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'liberation_elder', name:'闸房老人', role:'记路人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[8,31.5], work:[8,31.5], patrolRadius:0.5,
    dialog:[{ text:'「过时的话也是话。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'liberation_stallkeeper', name:'杂货摊的大人', role:'守摊人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[9,30.5], work:[9,30.5], patrolRadius:0.5,
    dialog:[{ text:'「墙又高了一点。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'liberation_child', name:'桥边的小孩', role:'岛民', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[10,32.5], work:[10,32.5], patrolRadius:0.5,
    dialog:[{ text:'「我刚回来过。」', options:[{ text:'和他聊聊', next:null }] }],
  },

  // ── 剧情 NPC：S031–S034 ───────────────────────────────────────────────
  {
    id:'weekly_editor', name:'热月', role:'报社代行主编', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-4,10], work:[-4,10], patrolRadius:0.5,
    dialog:[{ text:'「截稿之前，一切都还有救。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'weekly_schrodinger', name:'绵州薛定谔', role:'轮值编辑', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-5,9], work:[-5,9], patrolRadius:0.5,
    dialog:[{ text:'「稿酬和考据，总得先有一个。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'weekly_master', name:'物理达人', role:'轮值编辑', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-3,9], work:[-3,9], patrolRadius:0.5,
    dialog:[{ text:'「活动动员，我来。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'weekly_pigeon', name:'送报鸽', role:'发行鸽', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[-4,8], work:[-4,8], patrolRadius:0.5,
    dialog:[{ text:'「咕咕。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'huigui_keeper', name:'冥羽', role:'守炉人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[9,-32], work:[9,-32], patrolRadius:0.5,
    dialog:[{ text:'「说人话，炉子才亮。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'reverberate_keeper', name:'回音壁', role:'无人值守的回声', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[21,34], work:[21,34], patrolRadius:0.5,
    dialog:[{ text:'「你说一句，我晚一点还你一句。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'askway_keeper', name:'铜喇叭', role:'老亭敬语广播', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[4,-58.5], work:[4,-58.5], patrolRadius:0.5,
    dialog:[{ text:'「问路请讲，两问自理。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'askway_printer', name:'门牌机', role:'新亭值守打印', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[5,-59.5], work:[5,-59.5], patrolRadius:0.5,
    dialog:[{ text:'「F35 值守中。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'askway_huanmian', name:'幻眠', role:'路过的旧落款人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[3,-59.5], work:[3,-59.5], patrolRadius:0.5,
    dialog:[{ text:'「名字会走，路还在。」', options:[{ text:'和他聊聊', next:null }] }],
  },
  {
    id:'askway_child', name:'喷泉边小孩', role:'虚构路人', core:false, spawnChance:1, storyOnly:true,
    npcType:'story', type:'story', behavior:'field', workHours:[0,24],
    head:0xC9A47E, body:0x516579, home:[4,-60.5], work:[4,-60.5], patrolRadius:0.5,
    dialog:[{ text:'「你也要问路吗？」', options:[{ text:'和他聊聊', next:null }] }],
  },

];
