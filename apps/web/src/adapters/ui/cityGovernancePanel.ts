import { applyCityState, decorateCity, donateCity, getCityConfig, getCityState, subscribeCityGovernance, type CityProject } from '../../city/cityGovernanceClient';

let root: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let activeTab: 'collective' | 'personal' = 'collective';
let activeBuilding = '';

const money = (value: number) => `${value.toLocaleString()} 金币`;

function button(label: string, action: () => void, disabled = false): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener('click', action);
  return element;
}

function render(): void {
  if (!root) return;
  const config = getCityConfig();
  const state = getCityState();
  root.replaceChildren();
  const header = document.createElement('header');
  header.className = 'city-governance-head';
  const title = document.createElement('h2');
  title.textContent = activeBuilding ? '城市治理' : '城市治理';
  header.append(title, button('关闭', closeCityGovernancePanel));
  root.append(header);
  const tabs = document.createElement('nav');
  tabs.className = 'city-governance-tabs';
  for (const [tab, label] of [['collective', '城市集体建设'], ['personal', '个人建设']] as const) {
    const tabButton = button(label, () => { activeTab = tab; render(); });
    tabButton.classList.toggle('active', activeTab === tab);
    tabs.append(tabButton);
  }
  root.append(tabs);
  const status = document.createElement('p');
  status.dataset.cityStatus = 'true';
  status.textContent = state ? `云端进度 #${state.revision}` : '正在等待云端城市配置...';
  root.append(status);
  const body = document.createElement('main');
  body.className = 'city-governance-body';
  if (!config || !state) {
    body.append(document.createTextNode('城市建设数据暂时不可用，请稍后重试。'));
    body.append(button('重试', () => window.dispatchEvent(new CustomEvent('minicity:city-retry'))));
    root.append(body);
    return;
  }
  const list = document.createElement('div');
  list.className = 'city-governance-list';
  if (activeTab === 'collective') renderCollective(list, config.projects, state.projects);
  else renderPersonal(list, config, state);
  body.append(list);
  root.append(body);
}

function card(title: string, description: string): HTMLElement {
  const item = document.createElement('article');
  item.className = 'city-governance-card';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = description;
  item.append(heading, copy);
  return item;
}

function renderCollective(list: HTMLElement, projects: CityProject[], progress: Array<{ id: string; funded: number; built: boolean }>): void {
  for (const project of projects) {
    const saved = progress.find((entry) => entry.id === project.id);
    const item = card(project.name, project.description);
    const detail = document.createElement('p');
    detail.textContent = saved?.built ? '已建成，全城居民共享' : `募捐进度 ${money(saved?.funded ?? 0)} / ${money(project.cost)}`;
    item.append(detail);
    if (!saved?.built) {
      const amount = document.createElement('input');
      amount.type = 'number'; amount.min = '1'; amount.step = '1'; amount.value = String(Math.min(project.cost - (saved?.funded ?? 0), 100));
      amount.setAttribute('aria-label', `${project.name}捐款金额`);
      item.append(amount, button('捐款', async () => {
        const action = item.querySelector('button');
        if (!(action instanceof HTMLButtonElement)) return;
        action.disabled = true;
        try { await donateCity(project.id, Number(amount.value)); render(); }
        catch (error) { detail.textContent = error instanceof Error ? error.message : '捐款失败，请重试'; action.disabled = false; }
      }));
    }
    list.append(item);
  }
}

function renderPersonal(list: HTMLElement, config: NonNullable<ReturnType<typeof getCityConfig>>, state: NonNullable<ReturnType<typeof getCityState>>): void {
  for (const plot of config.personalPlots) {
    const item = card(plot.name, '选择一项装饰，建设完成后全城居民都能看到。');
    const occupied = state.decorations.find((entry) => entry.plotId === plot.id);
    if (occupied) {
      const owner = document.createElement('p');
      owner.textContent = `已由 ${occupied.ownerNickname} 建设：${config.decorations.find((entry) => entry.id === occupied.decorationId)?.name ?? occupied.decorationId}`;
      item.append(owner);
    } else {
      const select = document.createElement('select');
      select.setAttribute('aria-label', `${plot.name}装饰类型`);
      for (const id of plot.options) {
        const option = document.createElement('option');
        const decoration = config.decorations.find((entry) => entry.id === id);
        option.value = id; option.textContent = decoration ? `${decoration.name} · ${money(decoration.cost)}` : id;
        select.append(option);
      }
      item.append(select, button('建设', async () => {
        const action = item.querySelector('button');
        if (!(action instanceof HTMLButtonElement)) return;
        action.disabled = true;
        try { await decorateCity(plot.id, select.value); render(); }
        catch (error) { action.textContent = error instanceof Error ? error.message : '建设失败，请重试'; action.disabled = false; }
      }));
    }
    list.append(item);
  }
}

export function openCityGovernancePanel(buildingId = ''): void {
  activeBuilding = buildingId;
  if (!root) {
    root = document.createElement('section');
    root.className = 'city-governance-panel';
    root.setAttribute('aria-label', '城市治理');
    document.body.append(root);
    root.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCityGovernancePanel(); });
    unsubscribe = subscribeCityGovernance(() => { if (root?.classList.contains('open')) render(); });
  }
  root.classList.add('open');
  render();
  root.querySelector<HTMLButtonElement>('.city-governance-head button')?.focus();
}

export function closeCityGovernancePanel(): void { root?.classList.remove('open'); }
