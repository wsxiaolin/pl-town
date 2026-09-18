export type MutualAidMember = { uid: string; name: string };
export type MutualAidLink = { id: string; title: string };

/** 正文里可混排的片段：纯文本或讨论内引。 */
export type OrgSegment = string | { kind: 'link'; link: MutualAidLink };

/** 角色/职务（如：事务长、副事务长）。members 为空时用 note 补充说明。 */
export type MutualAidRole = { label: string; members: readonly MutualAidMember[]; note?: string };

export type MutualAidDepartment = {
  id: string;
  name: string;
  summary: string;
  requirements?: readonly string[];
  roles: readonly MutualAidRole[];
  members?: readonly MutualAidMember[];
};

export type MutualAidDiplomacy = {
  name: string;
  relation: string;
  discussion?: MutualAidLink;
};

export type MutualAidOrg = {
  title: string;
  nature: string;
  editors: readonly MutualAidMember[];
  motto: { text: string; author: MutualAidMember };
  welcome: string;
  notices: readonly (readonly OrgSegment[])[];
  leadership: readonly MutualAidRole[];
  departments: readonly MutualAidDepartment[];
  departmentNote: string;
  branches: readonly string[];
  diplomacy: readonly MutualAidDiplomacy[];
  announcements: readonly string[];
  honorary: readonly MutualAidMember[];
};

const m = (uid: string, name: string): MutualAidMember => ({ uid, name });
const d = (id: string, title: string): OrgSegment => ({ kind: 'link', link: { id, title } });

const WOLFGANG = m('5f2e1445ef04fa1c9fff91f7', '沃尔夫冈');
const REYUE = m('6983633baf078298e1386848', '热月');
const DUDU = m('6a16c8f11de17b628435ddc3', '杜Du');
const LECOURANT = m('625037e2cb3039e4639c366c', 'Lecourant');
const WULI_DAREN = m('64a0eeba72497b7fe9c76053', '物理の達人');

export const MUTUAL_AID_ORG: MutualAidOrg = {
  title: 'PMAG-人民互助团',
  nature: '民间组织',
  editors: [
    m('60e933da4ad4cae147f48a66', '故事里的人'),
    m('5e40b1749178a319c6ea5974', '北冥薛猫'),
    WOLFGANG,
  ],
  motto: {
    text: '没有绝对的利益，只有公平的互助，唯有互助，才能发展物实',
    author: m('630b931c8b2d083afd4e7b3b', '钇Yttrium'),
  },
  welcome: '欢迎个人与团体的加入！！',
  notices: [
    ['本文为新的总部主页，原主页', d('63c63bd44906dcddc28eb175', '互助团总部'), '停用'],
    [
      '由于历史原因，停运时间过长，期间成员的入退情况未能及时进行登记，故疑似永退的成员一律作为荣誉成员（此外原先的荣誉成员仍然为荣誉成员），若回归可直接申请原岗位（其他岗位也是可以的）。对于确认没有永退（物实最后的生活痕迹在六个月内）的成员，复原职（或改组后与原职对应的职位）。',
    ],
    ['同时，', d('64b68e415e2f05a09bf2163f', '服务用户协会'), '全部人员合并入本团，不再存在。'],
    ['同时出于新的社区状况，本团原规则、建制、计划应当作出相应的修改。我初步地想了一些，但还需要大家的意见nwn。'],
  ],
  leadership: [
    { label: '团长', members: [WOLFGANG] },
    { label: '副团长', members: [m('605a6f5b0e7b6176dffc0b99', 'Soloist')] },
  ],
  departments: [
    {
      id: 'welcome',
      name: '迎新互助团',
      summary: '本团的核心任务是凝聚新用户，引导和便利他们参与社区生活，解决其困难，代表其发声。同时若有可能的话，参与外宣工作。',
      requirements: ['本团应保持相当比例的非老用户。'],
      roles: [
        { label: '事务长', members: [REYUE] },
        { label: '副事务长', members: [DUDU] },
      ],
      members: [WULI_DAREN],
    },
    {
      id: 'legal',
      name: '法务互助团',
      summary: '本团的核心任务是宣传条例、提供日常条例咨询服务、在矛盾事件中代理辩护、代写文书（包括提案、辩护书、申请书等）、积极发现条例漏洞空白并向管理层提供建议。',
      requirements: ['本团成员应通过对条例熟悉程度和文书工作水平的考核，有参与条例编写经历的优先。'],
      roles: [
        { label: '事务长', members: [WOLFGANG] },
        { label: '副事务长', members: [REYUE, LECOURANT, DUDU] },
      ],
    },
    {
      id: 'experiment',
      name: '实验互助团',
      summary: '本团的核心任务是促进实验区与黑洞区的联结，增强实验区的社区参与度，负责访查实验区民意、举办相关活动等。',
      requirements: ['本团成员应均有相当的实验能力和实验区生活经历（至少有1篇实验区精选）。'],
      roles: [
        { label: '事务长', members: [m('5d242ada04d33bdc1c561891', '量子泡沫')] },
        { label: '副事务长', members: [m('67cbe44664b6f3ce1a89dbf1', '不知道了呐'), WOLFGANG] },
      ],
    },
    {
      id: 'foreign',
      name: '外交部',
      summary: '本部的核心任务是处理本团与物实各界的关系，负责宣传、联络、合作、接受领导等工作。',
      requirements: ['在其他团体中任职的优先。'],
      roles: [
        { label: '事务长', members: [WOLFGANG] },
        { label: '副事务长', members: [REYUE] },
      ],
    },
    {
      id: 'internal',
      name: '内务部',
      summary: '本部的核心任务是组织的内部事务，如更新成员登记、给成员发放津贴、统筹规划各项工作、配合管理层对内检查等。',
      roles: [
        { label: '财政事务', members: [], note: '由沃尔夫冈基金会代办' },
        { label: '事务长', members: [m('60ff67f1ee124cbc5b6879df', 'Electrolysis电解')] },
      ],
      members: [m('60f439e5289dc7cdebf70f88', '零次互反律'), m('5f769da706172c9f5f66ba59', 'Bromine溴')],
    },
    {
      id: 'taskforce',
      name: '综合工作组',
      summary: '本组是临时机构，主要用于改组原常规工作组、没有任务但在册的原成员和部分服务用户协会合并入的成员。同时本组也承担探索互助团新职能的工作，将有新的机构从本组中生出。',
      roles: [{ label: '事务长', members: [m('6260042ff3d2fc0d1926d63c', '眺跳')] }],
      members: [
        m('65412f18c6c54c83af147a43', '小黑猫'),
        m('5f11a9707f70f6e3527fb4ae', '复兴物实'),
        WULI_DAREN,
        m('63ea4191fd0015ad302ea261', '灭神之天'),
        m('618e73e65ec41e3d481c041b', '麻雀~'),
        m('62c8c609dee91d435cb1c4a6', 'Stellapolaris'),
        m('61483c4ca21da11afa8d0cf3', '南楼梦风'),
        m('6481e4a2cd886b1519080ed5', '晓年'),
        m('6471c8012276341fc2e02006', '昼夜下的诗人'),
        m('61a61de05d768d9a86643fcd', '墨怡'),
      ],
    },
    {
      id: 'advisory',
      name: '顾问团',
      summary: '本团负责给其他各机构的工作或其他组织事务提出建议。',
      roles: [],
      members: [LECOURANT],
    },
  ],
  departmentNote: '各直辖机构的事务长临时由团长根据原职位任命，成员可提出申请，根据客观的能力情况和同僚意见重新任命。',
  branches: ['暂无'],
  diplomacy: [
    { name: '逐影联盟', relation: '盟友', discussion: { id: '6204db860f15cd000184df8e', title: '逐影联盟' } },
    { name: '社区文联', relation: '盟友', discussion: { id: '6a904ecf7708f9e9c3f5a91a', title: '社区文联' } },
    { name: '黄鸡部', relation: '盟友', discussion: { id: '69a6dd7bca7ceb749317f4d3', title: '黄鸡部' } },
    { name: '鸣野组织', relation: '盟友', discussion: { id: '68ea5b856d285b2dc3279c8f', title: '鸣野组织' } },
    { name: '理想国计划-社区组', relation: '接受其领导，但保持完全独立' },
  ],
  announcements: [],
  honorary: [
    m('630b931c8b2d083afd4e7b3b', '摸金'),
    m('63763da8fee2323ad27f5deb', '屑狗'),
    m('6337e70c7cf4dd29b93c9406', '旧夏浅入梦'),
    m('6023c57e2383ab2775485c02', '刃破梦人'),
    m('60c4052b6d5cfca210a44273', '屑米粥'),
    m('62e3429db695b0d5a5bed836', '理解一切的屑'),
    m('61298987933d333d44bae760', '逐影星空'),
    m('635512d4c64b7df5e773d1d1', 'Eromanga'),
    m('624d99b86ee58eb04ed9173f', '勿忘国耻'),
    m('5f2663bbfb663239dc4a644e', '仙宇不是仙'),
    m('63859573fee2328189805086', '鲸落星河湾'),
    m('635260bfc64b7d76907394c8', '冬眠的梅比乌斯'),
    m('638c6f14fee23279b380b7ed', '苏卡'),
    m('5e8dad619cd133b9bc9f47a8', '从火星来的黑猫'),
    m('630af8c88b2d0852164e7326', '是叶天帝不是万叶'),
    m('6136167e1c8c2f0f991c8ac9', 'Shadow~'),
    m('63bacba007f0fe6918fd837f', '星然吖'),
    m('63d320dd07f0fe0c6efe36f9', '黑弟不会电路'),
    m('629b3ca3d58c96144218934a', '星璃若蓝'),
    m('62512eaccb30397bac9c3d22', '䥓铌钛镁'),
    m('639682799a3b23f7bb8036e2', '一只没逝找逝的狗'),
    m('611511da731a8e40fa590e5a', 'e'),
    m('63d64f8b07f0fe1962fe64ed', '我叫维度武器'),
    m('625ce25a66143c6f9aa33232', '姜志远'),
    m('63e4dd7cfd0015921d2e76c1', '一支烟火'),
    m('63bf82d007f0fea0ddfda8ff', '冲击者'),
    m('62f25786fcad79e031bf228b', '作业，少吗？'),
    m('62e3b3aab695b04605bee06c', '八重宫司大人'),
    m('639882c89a3b230cae804cb6', '扫木'),
    m('639fe1ab9a3b231ae9809634', '回来的历史君'),
    m('613373d91c8c2f46791c6a4f', '星中星'),
    m('61fa1c7ff020f25214ddde2d', '脚凳'),
    m('5d8b5958009c359452539f82', '氯'),
    m('634c118ec64b7d346c7355c3', '黑暗下的诗人'),
    m('65a541a7a3542d0d0f6ce1b3', '白'),
    m('636f41fffee23203b07ef119', 'みづき'),
    m('62e8ea01b695b00b94bf261e', '琪娅'),
    m('62ca35ba4a3f875e1dd85c31', 'PhysicsLab'),
    m('62d62c2f2f3a2a20ee8ce583', '胡桃～'),
    m('6499228e0bb228fa1ff158dd', '吴梓烨'),
    m('60894af11043f64b0aa85734', '如梦幻泡影'),
  ],
};
