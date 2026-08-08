import { COMMUNITY_NPCS } from './communityNpcs';
// ── NPC 档案 ─────────────────────────────────────────────────────────────────
export const NPC_PROFILES = [...COMMUNITY_NPCS,
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
    id:'bunala', name:'布拿拉工', role:'布拿拉宫主人', core:true, spawnChance:1,
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
];
