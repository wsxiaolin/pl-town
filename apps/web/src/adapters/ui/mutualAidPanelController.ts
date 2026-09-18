import {
  MUTUAL_AID_ORG,
  type MutualAidMember,
  type MutualAidRole,
  type OrgSegment,
} from '../../city/data/mutualAidOrg';

export type MutualAidPanelController = { open: () => void; close: () => void };

/** 团长与各机构事务长用高亮标签，其余（副职、成员、荣誉成员）用普通标签。 */
function isLeadRole(label: string): boolean {
  return label === '团长' || label === '事务长';
}

export function createMutualAidPanelController(document: Document): MutualAidPanelController {
  const panel = document.getElementById('mutualAidPanel') as HTMLDivElement;
  const title = document.getElementById('mutualAidTitle') as HTMLHeadingElement;
  const meta = document.getElementById('mutualAidMeta') as HTMLParagraphElement;
  const body = document.getElementById('mutualAidBody') as HTMLDivElement;

  const org = MUTUAL_AID_ORG;
  let rendered = false;

  function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function chip(member: MutualAidMember, lead = false): HTMLElement {
    const node = element('span', lead ? 'ma-chip ma-chip-lead' : 'ma-chip', member.name);
    node.dataset.uid = member.uid;
    node.title = `物实用户 ${member.uid}`;
    return node;
  }

  function membersRow(members: readonly MutualAidMember[], lead = false): HTMLElement {
    const row = element('div', 'ma-members');
    row.append(...members.map((member) => chip(member, lead)));
    return row;
  }

  function roleRow(role: MutualAidRole): HTMLElement {
    const row = element('div', 'ma-role');
    row.append(element('span', 'ma-role-label', role.label));
    if (role.members.length) row.append(membersRow(role.members, isLeadRole(role.label)));
    else if (role.note) row.append(element('span', 'ma-role-note', role.note));
    return row;
  }

  function renderSegments(segments: readonly OrgSegment[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    for (const segment of segments) {
      if (typeof segment === 'string') fragment.append(document.createTextNode(segment));
      else {
        const link = element('span', 'ma-link', segment.link.title);
        link.dataset.discussion = segment.link.id;
        fragment.append(link);
      }
    }
    return fragment;
  }

  function section(titleText: string, ...children: (Node | null)[]): HTMLElement {
    const wrapper = element('section', 'ma-section');
    wrapper.append(element('h3', 'ma-section-title', titleText));
    for (const child of children) if (child) wrapper.append(child);
    return wrapper;
  }

  function buildMasthead(): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const motto = element('blockquote', 'ma-motto');
    motto.append(element('q', undefined, org.motto.text));
    const author = element('div', 'ma-motto-author', `——第一任团长 ${org.motto.author.name}`);
    author.dataset.uid = org.motto.author.uid;
    motto.append(author);
    fragment.append(motto);
    fragment.append(element('p', 'ma-welcome', org.welcome));
    return fragment;
  }

  function buildNotices(): HTMLElement {
    const notices = org.notices.map((segments) => {
      const paragraph = element('p', 'ma-notice');
      paragraph.append(renderSegments(segments));
      return paragraph;
    });
    return section('团务备忘', ...notices);
  }

  function buildLeadership(): HTMLElement {
    const card = element('div', 'ma-card');
    card.append(...org.leadership.map(roleRow));
    return section('人员结构与分工', card);
  }

  function buildDepartment(
    department: (typeof org.departments)[number],
  ): HTMLElement {
    const card = element('div', 'ma-card');
    card.append(element('h4', 'ma-dept-name', department.name));
    card.append(element('p', 'ma-dept-summary', department.summary));
    for (const requirement of department.requirements ?? []) {
      card.append(element('p', 'ma-dept-req', `考核与要求：${requirement}`));
    }
    if (department.roles.length) {
      const roles = element('div', 'ma-dept-roles');
      roles.append(...department.roles.map(roleRow));
      card.append(roles);
    }
    if (department.members?.length) {
      const members = element('div', 'ma-dept-members');
      members.append(element('span', 'ma-role-label', '成员'));
      members.append(membersRow(department.members));
      card.append(members);
    }
    return card;
  }

  function buildDepartments(): HTMLElement {
    const note = element('p', 'ma-note', org.departmentNote);
    return section('直辖机构与成员', note, ...org.departments.map(buildDepartment));
  }

  function buildBranches(): HTMLElement {
    const list = element('div', 'ma-card');
    list.append(...org.branches.map((branch) => element('p', 'ma-branch', branch)));
    return section('分支机构', list);
  }

  function buildDiplomacy(): HTMLElement {
    const card = element('div', 'ma-card');
    for (const entry of org.diplomacy) {
      const row = element('div', 'ma-diplomacy-row');
      if (entry.discussion) {
        const link = element('span', 'ma-link', entry.name);
        link.dataset.discussion = entry.discussion.id;
        row.append(link);
      } else {
        row.append(element('span', undefined, entry.name));
      }
      row.append(element('span', 'ma-relation', entry.relation));
      card.append(row);
    }
    return section('外交状况', card);
  }

  function buildAnnouncements(): HTMLElement {
    const children = org.announcements.length
      ? org.announcements.map((item) => element('p', 'ma-notice', item))
      : [element('p', 'ma-announce-empty', '暂无公告')];
    return section('公告板', ...children);
  }

  function buildHonorary(): HTMLElement {
    const grid = element('div', 'ma-honorary');
    grid.append(...org.honorary.map((member) => chip(member)));
    return section('荣誉成员', grid);
  }

  function build() {
    title.textContent = org.title;
    meta.textContent = [
      `团体性质：${org.nature}`,
      `责任编辑：${org.editors.map((editor) => editor.name).join('、')}`,
    ].join(' · ');

    const fragment = document.createDocumentFragment();
    fragment.append(buildMasthead());
    fragment.append(buildNotices());
    fragment.append(buildLeadership());
    fragment.append(buildDepartments());
    fragment.append(buildBranches());
    fragment.append(buildDiplomacy());
    fragment.append(buildAnnouncements());
    fragment.append(buildHonorary());
    body.replaceChildren(fragment);
    rendered = true;
  }

  function open() {
    if (!rendered) build();
    panel.classList.add('open');
  }

  function close() {
    panel.classList.remove('open');
  }

  return { open, close };
}
