/**
 * 世界配置页的商品目录编辑器（名称 / 单价 / 上下架 / 新增 / 移除）。
 *
 * 从 app.js 拆出：app.js 已接近 Agents.md 的 1000 行红线，商品面板的草稿、
 * 校验与保存自成闭环，只依赖 app.js 注入的 state / node / showNotice /
 * confirmAction / api。
 */

const ITEM_ID_PATTERN = /^[a-z0-9_]{2,64}$/;
const FALLBACK_LIMITS = Object.freeze({ nameMax: 40, priceMax: 1_000_000, productMax: 50 });

export function createShopEditor(deps) {
  const { state, node, showNotice, confirmAction, api } = deps;
  let limits = { ...FALLBACK_LIMITS };

  const applyLimits = (payload) => {
    const nameMax = Number(payload?.nameMax);
    const priceMax = Number(payload?.priceMax);
    const productMax = Number(payload?.productMax);
    limits = {
      nameMax: Number.isInteger(nameMax) && nameMax > 0 ? nameMax : FALLBACK_LIMITS.nameMax,
      priceMax: Number.isInteger(priceMax) && priceMax > 0 ? priceMax : FALLBACK_LIMITS.priceMax,
      productMax: Number.isInteger(productMax) && productMax > 0 ? productMax : FALLBACK_LIMITS.productMax,
    };
  };

  const snapshot = (draft) => JSON.stringify(draft.map((product) => [product.itemId, product.name.trim(), product.unitPrice, product.enabled !== false]));

  function renderRow(product, index) {
    const row = node('div', undefined, 'shop-row');
    let idCell;
    if (product.isNew) {
      const idInput = node('input');
      idInput.type = 'text';
      idInput.value = product.itemId;
      idInput.className = 'shop-item-id';
      idInput.maxLength = 64;
      idInput.placeholder = '商品 ID';
      idInput.setAttribute('aria-label', '商品 ID（小写字母、数字、下划线）');
      idInput.addEventListener('input', () => { state.worldShopDraft[index].itemId = idInput.value; renderDirty(); });
      // Trim on blur so the DOM value and the validated state stay identical.
      idInput.addEventListener('blur', () => {
        const trimmed = idInput.value.trim();
        idInput.value = trimmed;
        state.worldShopDraft[index].itemId = trimmed;
        renderDirty();
      });
      idCell = idInput;
    } else {
      idCell = node('span', product.itemId, 'shop-item-id');
      idCell.title = product.itemId;
    }
    const nameInput = node('input');
    nameInput.type = 'text';
    nameInput.value = product.name;
    nameInput.maxLength = limits.nameMax;
    nameInput.placeholder = '商品名称';
    nameInput.setAttribute('aria-label', `商品 ${product.itemId} 名称`);
    nameInput.addEventListener('input', () => { state.worldShopDraft[index].name = nameInput.value; renderDirty(); });
    nameInput.addEventListener('blur', () => {
      const trimmed = nameInput.value.trim();
      nameInput.value = trimmed;
      state.worldShopDraft[index].name = trimmed;
      renderDirty();
    });
    const priceInput = node('input');
    priceInput.type = 'number';
    priceInput.value = product.unitPrice;
    priceInput.min = '1';
    priceInput.max = String(limits.priceMax);
    priceInput.step = '1';
    priceInput.placeholder = '单价';
    priceInput.setAttribute('aria-label', `商品 ${product.itemId} 单价`);
    priceInput.addEventListener('input', () => { state.worldShopDraft[index].unitPrice = Number(priceInput.value) || 0; renderDirty(); });
    const enabledLabel = node('label', undefined, 'shop-enabled');
    const enabledInput = node('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = product.enabled !== false;
    // No aria-label: the wrapping label already exposes the visible 在售 text.
    enabledInput.addEventListener('change', () => { state.worldShopDraft[index].enabled = enabledInput.checked; renderDirty(); });
    enabledLabel.append(enabledInput, node('span', '在售'));
    const remove = node('button', '移除', 'shop-remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `移除商品 ${product.itemId}`);
    remove.addEventListener('click', () => { state.worldShopDraft.splice(index, 1); render(); });
    row.append(idCell, nameInput, priceInput, enabledLabel, remove);
    return row;
  }

  function render() {
    const container = document.querySelector('#worldShopRows');
    const rows = state.worldShopDraft.map(renderRow);
    container.replaceChildren(...(rows.length ? rows : [node('p', '商店当前没有商品，点击「添加商品」创建。', 'empty shop-empty')]));
    renderDirty();
  }

  function renderDirty() {
    const count = state.worldShopDraft.length;
    const active = state.worldShopDraft.filter((product) => product.enabled !== false).length;
    const stateLabel = document.querySelector('#worldShopState');
    if (stateLabel) stateLabel.textContent = count ? `${active}/${count} 在售` : '空';
    const dirtyLabel = document.querySelector('#worldShopDirty');
    if (dirtyLabel) dirtyLabel.textContent = snapshot(state.worldShopDraft) !== snapshot(state.worldShop) ? '有未保存的更改' : '';
  }

  function addRow() {
    if (state.worldShopDraft.length >= limits.productMax) { showNotice(`商品数量已达上限（${limits.productMax}）`); return; }
    // The id starts empty (placeholder shows where to type it) so an operator
    // who skips the field gets a validation error instead of a product
    // literally called "new_item_1".
    state.worldShopDraft.push({ itemId: '', name: '', unitPrice: 10, enabled: true, isNew: true });
    render();
    document.querySelector('#worldShopRows .shop-row:last-child .shop-item-id')?.focus();
  }

  function validate() {
    const seen = new Set();
    for (const product of state.worldShopDraft) {
      if (!ITEM_ID_PATTERN.test(product.itemId)) return `商品 ID「${product.itemId || '空'}」无效：仅限小写字母、数字、下划线，长度 2-64`;
      if (seen.has(product.itemId)) return `商品 ID「${product.itemId}」重复`;
      seen.add(product.itemId);
      if (!product.name.trim()) return `商品「${product.itemId}」缺少名称`;
      if (product.name.trim().length > limits.nameMax) return `商品「${product.itemId}」名称过长（上限 ${limits.nameMax} 字）`;
      if (!Number.isInteger(product.unitPrice) || product.unitPrice < 1 || product.unitPrice > limits.priceMax) return `商品「${product.itemId}」单价无效：需为 1-${limits.priceMax} 的整数`;
    }
    return '';
  }

  async function persist() {
    const button = document.querySelector('#worldShopSave');
    button.disabled = true;
    try {
      const products = state.worldShopDraft.map((product) => ({ itemId: product.itemId, name: product.name.trim(), unitPrice: product.unitPrice, enabled: product.enabled !== false }));
      const data = await api('/world/shop', { method: 'POST', body: JSON.stringify({ products }) });
      state.worldShop = Array.isArray(data.products) ? data.products : [];
      state.worldShopDraft = state.worldShop.map((product) => ({ ...product }));
      render();
      const warnings = Array.isArray(data.warnings) && data.warnings.length
        ? `，但剧情引用商品被移除：${data.warnings.join('、')}（新居民将无法获得该物品）`
        : '';
      showNotice(`商品配置已保存并推送给全服${warnings}`, !warnings);
    } catch (error) { showNotice(error.message); } finally { button.disabled = false; }
  }

  async function save() {
    const invalid = validate();
    if (invalid) { showNotice(invalid); return; }
    if (!state.worldShopDraft.length && state.worldShop.length) {
      confirmAction('清空商品目录', '将下架全部商品，居民商店将没有在售商品（已购道具保留）。', () => persist());
      return;
    }
    await persist();
  }

  function reset() {
    state.worldShopDraft = state.worldShop.map((product) => ({ ...product }));
    render();
  }

  return { applyLimits, render, addRow, save, reset };
}
