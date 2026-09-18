import assert from 'node:assert/strict';
import test from 'node:test';
import { MUTUAL_AID_ORG, type MutualAidRole } from '../../src/city/data/mutualAidOrg';

const roleOf = (roles: readonly MutualAidRole[], label: string) =>
  roles.find((role) => role.label === label);

/** 数据里的每个文本都应是干净的展示文本，不应残留物实富文本标签。 */
function assertCleanText(texts: readonly string[]) {
  for (const text of texts) {
    assert.ok(text.trim().length > 0, '存在空白文本');
    assert.ok(!/<\/?(user|discussion|b|a|size)\b/i.test(text), `残留富文本标签：${text}`);
  }
}

test('互助团资料保留标题、性质与责任编辑', () => {
  assert.equal(MUTUAL_AID_ORG.title, 'PMAG-人民互助团');
  assert.equal(MUTUAL_AID_ORG.nature, '民间组织');
  assert.deepEqual(
    MUTUAL_AID_ORG.editors.map((editor) => editor.name),
    ['故事里的人', '北冥薛猫', '沃尔夫冈'],
  );
  assert.equal(MUTUAL_AID_ORG.motto.author.name, '钇Yttrium');
  assertCleanText([MUTUAL_AID_ORG.title, MUTUAL_AID_ORG.nature, MUTUAL_AID_ORG.motto.text, MUTUAL_AID_ORG.welcome]);
});

test('团长与副团长对应正确', () => {
  assert.deepEqual(roleOf(MUTUAL_AID_ORG.leadership, '团长')?.members.map((m) => m.name), ['沃尔夫冈']);
  assert.deepEqual(roleOf(MUTUAL_AID_ORG.leadership, '副团长')?.members.map((m) => m.name), ['Soloist']);
});

test('七个直辖机构齐全且都给出职责说明', () => {
  assert.deepEqual(
    MUTUAL_AID_ORG.departments.map((department) => department.name),
    ['迎新互助团', '法务互助团', '实验互助团', '外交部', '内务部', '综合工作组', '顾问团'],
  );
  for (const department of MUTUAL_AID_ORG.departments) {
    assert.ok(department.summary.trim().length > 0, `${department.name} 缺少职责说明`);
    assert.ok(department.id.length > 0, `${department.name} 缺少 id`);
  }
  // 除顾问团外，每个机构都有一名事务长。
  for (const department of MUTUAL_AID_ORG.departments.filter((item) => item.id !== 'advisory')) {
    assert.equal(roleOf(department.roles, '事务长')?.members.length, 1, `${department.name} 事务长数量异常`);
  }
});

test('内务部财政事务保留代办说明', () => {
  const internal = MUTUAL_AID_ORG.departments.find((department) => department.id === 'internal');
  const finance = roleOf(internal!.roles, '财政事务');
  assert.ok(finance);
  assert.equal(finance!.members.length, 0);
  assert.equal(finance!.note, '由沃尔夫冈基金会代办');
});

test('所有在册成员都有 uid 与非空姓名', () => {
  const members = [
    ...MUTUAL_AID_ORG.editors,
    ...MUTUAL_AID_ORG.leadership.flatMap((role) => role.members),
    ...MUTUAL_AID_ORG.departments.flatMap((department) => [
      ...department.roles.flatMap((role) => role.members),
      ...(department.members ?? []),
    ]),
    ...MUTUAL_AID_ORG.honorary,
  ];
  for (const member of members) {
    assert.ok(member.name.trim().length > 0, '存在空姓名成员');
    assert.ok(/^[0-9a-f]{24}$/.test(member.uid), `uid 格式异常：${member.uid}`);
  }
});

test('外交状况包含四位盟友与理想国领导关系', () => {
  assert.equal(MUTUAL_AID_ORG.diplomacy.length, 5);
  const allies = MUTUAL_AID_ORG.diplomacy.filter((entry) => entry.relation === '盟友');
  assert.deepEqual(
    allies.map((entry) => entry.name),
    ['逐影联盟', '社区文联', '黄鸡部', '鸣野组织'],
  );
  for (const ally of allies) assert.ok(ally.discussion?.id, `${ally.name} 缺少讨论内引`);
  const ideal = MUTUAL_AID_ORG.diplomacy.find((entry) => entry.name === '理想国计划-社区组');
  assert.ok(ideal);
  assert.match(ideal!.relation, /独立/);
});

test('备忘录保留互助团总部与服务用户协会的原讨论内引', () => {
  const links = MUTUAL_AID_ORG.notices
    .flat()
    .filter((segment): segment is { kind: 'link'; link: { id: string; title: string } } => typeof segment !== 'string')
    .map((segment) => segment.link.title);
  assert.deepEqual(links, ['互助团总部', '服务用户协会']);
});

test('荣誉成员名单完整入库且无空项', () => {
  assert.equal(MUTUAL_AID_ORG.honorary.length, 41);
  assert.equal(MUTUAL_AID_ORG.honorary[0]!.name, '摸金');
  assert.equal(MUTUAL_AID_ORG.honorary[MUTUAL_AID_ORG.honorary.length - 1]!.name, '如梦幻泡影');
  assertCleanText(MUTUAL_AID_ORG.honorary.map((member) => member.name));
  assert.deepEqual(MUTUAL_AID_ORG.branches, ['暂无']);
  assert.equal(MUTUAL_AID_ORG.announcements.length, 0);
});
