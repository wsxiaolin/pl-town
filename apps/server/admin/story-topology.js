const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = (selector) => document.querySelector(selector);
const svg = $('#topologySvg');
const statusEl = $('#topologyStatus');
const emptyEl = $('#topologyEmpty');
const selectEl = $('#topologyStorySelect');
const legendEl = $('#topologyLegend');

const showStatus = (message, success = false) => {
  statusEl.textContent = message;
  statusEl.className = `topology-status${success ? ' success' : ''}`;
  statusEl.hidden = !message;
};

async function api(path) {
  const response = await fetch(`/admin/api${path}`, { credentials: 'same-origin' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || '请求失败');
  return payload;
}

function el(name, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = String(text);
  return node;
}

// Build a layered top-down layout via BFS from the start node over choice edges,
// then add trigger edges and any nodes unreachable from the start at the bottom.
function layoutTopology(summary) {
  const nodes = summary.nodes ?? [];
  const edges = summary.edges ?? [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const choiceEdges = edges.filter((e) => e.kind === 'choice' && nodeIds.has(e.from) && nodeIds.has(e.to));
  const triggerEdges = edges.filter((e) => e.kind !== 'choice');

  const adjacency = new Map();
  for (const edge of choiceEdges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }

  const level = new Map();
  const queue = [];
  if (summary.startNode && nodeIds.has(summary.startNode)) {
    level.set(summary.startNode, 0);
    queue.push(summary.startNode);
  }
  // Also seed from nodes with no incoming choice edge so disconnected subgraphs surface.
  const incoming = new Set(choiceEdges.map((e) => e.to));
  for (const node of nodes) {
    if (!incoming.has(node.id) && !level.has(node.id)) { level.set(node.id, 0); queue.push(node.id); }
  }
  // Standard BFS: assign each node a level on first visit and never re-enqueue.
  // Re-enqueuing on a longer path would loop forever on cycles (e.g. the
  // confrontation <-> abandon-confirm back-edge), growing the queue unbounded.
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentLevel = level.get(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!level.has(next)) {
        level.set(next, currentLevel + 1);
        queue.push(next);
      }
    }
  }
  // Any node never reached gets placed at the deepest known level + 1.
  let maxLevel = 0;
  for (const value of level.values()) maxLevel = Math.max(maxLevel, value);
  for (const node of nodes) if (!level.has(node.id)) { maxLevel += 1; level.set(node.id, maxLevel); }

  const layers = new Map();
  for (const [id, value] of level) {
    if (!layers.has(value)) layers.set(value, []);
    layers.get(value).push(id);
  }
  return { level, layers, choiceEdges, triggerEdges, maxLevel };
}

function renderTopology(summary) {
  svg.replaceChildren();
  if (!summary || !summary.nodes?.length) { emptyEl.hidden = false; legendEl.hidden = true; return; }
  emptyEl.hidden = true;
  legendEl.hidden = false;

  const nodeTitle = new Map(summary.nodes.map((n) => [n.id, n.title || n.id]));
  const { level, layers, choiceEdges, triggerEdges } = layoutTopology(summary);

  const NODE_W = 150;
  const NODE_H = 44;
  const LAYER_GAP = 90;
  const COL_GAP = 28;
  const PAD = 24;

  const positions = new Map();
  const sortedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0]);
  let width = PAD * 2;
  let height = PAD * 2;
  sortedLayers.forEach(([layerLevel, ids]) => {
    const rowWidth = ids.length * NODE_W + (ids.length - 1) * COL_GAP;
    width = Math.max(width, rowWidth + PAD * 2);
    const y = PAD + layerLevel * (NODE_H + LAYER_GAP);
    height = Math.max(height, y + NODE_H + PAD);
    ids.forEach((id, index) => {
      const x = PAD + index * (NODE_W + COL_GAP);
      positions.set(id, { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 });
    });
  });

  // Trigger sources are rendered as small trigger nodes beside their target.
  const triggerPositions = new Map();
  const triggerSources = [...new Set(triggerEdges.map((e) => e.from))];
  triggerSources.forEach((source) => {
    const targets = triggerEdges.filter((e) => e.from === source).map((e) => e.to);
    const firstTarget = targets[0];
    const targetPos = positions.get(firstTarget);
    if (!targetPos) return;
    const x = Math.max(PAD, targetPos.x - NODE_W * 0.7);
    const y = targetPos.y - NODE_H * 0.55;
    triggerPositions.set(source, { x, y, cx: x + NODE_W * 0.5, cy: y + NODE_H * 0.5 });
  });

  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const defs = el('defs');
  const marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
  marker.append(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#176b4a' }));
  defs.append(marker);
  svg.append(defs);

  // Edges first so nodes sit on top.
  const edgeLayer = el('g');
  const drawEdge = (fromPos, toPos, kind) => {
    const path = el('path', {
      d: `M ${fromPos.cx} ${fromPos.cy + (fromPos === toPos ? 0 : 0)} C ${fromPos.cx} ${(fromPos.cy + toPos.cy) / 2}, ${toPos.cx} ${(fromPos.cy + toPos.cy) / 2}, ${toPos.cx} ${toPos.cy}`,
      class: `topology-edge ${kind === 'choice' ? '' : kind}`,
      'marker-end': 'url(#arrow)',
    });
    edgeLayer.append(path);
  };
  for (const edge of choiceEdges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (from && to) drawEdge(from, to, 'choice');
  }
  for (const edge of triggerEdges) {
    const from = triggerPositions.get(edge.from);
    const to = positions.get(edge.to);
    if (from && to) drawEdge(from, to, edge.kind);
  }
  svg.append(edgeLayer);

  // Trigger nodes.
  const triggerLayer = el('g');
  for (const [source, pos] of triggerPositions) {
    const group = el('g', { class: `topology-trigger ${edgeKindForSource(source, triggerEdges)}`, transform: `translate(${pos.x}, ${pos.y})` });
    group.append(el('rect', { width: String(NODE_W * 0.7), height: String(NODE_H * 0.7), rx: '6' }));
    const label = el('text', { x: String(NODE_W * 0.35), y: String(NODE_H * 0.42), 'text-anchor': 'middle' }, source);
    group.append(label);
    triggerLayer.append(group);
  }
  svg.append(triggerLayer);

  // Story nodes.
  const nodeLayer = el('g');
  for (const [id, pos] of positions) {
    const isStart = id === summary.startNode;
    const group = el('g', { class: `topology-node${isStart ? ' start' : ''}`, transform: `translate(${pos.x}, ${pos.y})` });
    group.append(el('rect', { width: String(NODE_W), height: String(NODE_H), rx: '7' }));
    group.append(el('text', { x: '10', y: '18' }, nodeTitle.get(id) ?? id));
    group.append(el('text', { x: '10', y: '34', class: 'topology-node-id' }, id));
    nodeLayer.append(group);
  }
  svg.append(nodeLayer);
}

function edgeKindForSource(source, triggerEdges) {
  const edge = triggerEdges.find((e) => e.from === source);
  return edge?.kind ?? 'actor';
}

async function loadTopology(storyId) {
  try {
    selectEl.disabled = true;
    const data = await api(`/story-topology?storyId=${encodeURIComponent(storyId)}`);
    const summary = data.summary;
    $('#topologyTitle').textContent = summary.title || '剧情拓扑';
    $('#topologySubtitle').textContent = `只读视图 · ${summary.nodes?.length ?? 0} 个节点 · ${summary.edges?.length ?? 0} 条边 · 定义版本 ${summary.definitionVersion || 0}`;
    renderTopology(summary);
  } catch (error) {
    showStatus(error.message);
  } finally {
    selectEl.disabled = false;
  }
}

async function init() {
  try {
    const session = await api('/session');
    if (!session.authenticated) { window.location.href = '/admin'; return; }
    const catalog = await api('/stories');
    if (!catalog.items?.length) { showStatus('当前没有可展示的剧情。'); return; }
    selectEl.append(...catalog.items.map((story) => {
      const option = document.createElement('option');
      option.value = story.id;
      option.textContent = `${story.title} (${story.id})`;
      return option;
    }));
    selectEl.hidden = false;
    selectEl.addEventListener('change', () => void loadTopology(selectEl.value));
    await loadTopology(selectEl.value || catalog.items[0].id);
  } catch (error) {
    showStatus(error.message);
  }
}

void init();
