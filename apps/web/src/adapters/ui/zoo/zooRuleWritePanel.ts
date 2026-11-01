import {
  ZOO_RULE_DEFAULTS,
  ZOO_RULE_MAX_LENGTH,
  type ZooRuleDirection,
} from '../../../city/zoo/zooCollectionStore';

export interface ZooRuleWritePanelOptions {
  document?: Document;
  onSubmit: (direction: ZooRuleDirection, line: string) => void;
  onCancel?: () => void;
}

const DIRECTIONS: readonly { id: ZooRuleDirection; label: string; hint: string }[] = [
  { id: 'keep', label: '写一条让人安心的规则', hint: '留给下一位游客的第一条规则。' },
  { id: 'joy', label: '写一条让人开心的规则', hint: '附则二说，若守则与你的快乐冲突，请以快乐为准。' },
  { id: 'pass', label: '先留空，交给下一位', hint: '空白也算一条。' },
];

export function openZooRuleWritePanel(options: ZooRuleWritePanelOptions): void {
  const doc = options.document ?? window.document;
  const overlay = doc.createElement('div');
  overlay.className = 'zoo-panel-overlay';

  const panel = doc.createElement('section');
  panel.className = 'zoo-panel zoo-rule-write';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '守则第七条');
  overlay.appendChild(panel);

  const header = doc.createElement('header');
  header.className = 'zoo-panel-header';
  const title = doc.createElement('h2');
  title.className = 'zoo-panel-title';
  title.textContent = '守则第七条';
  const close = doc.createElement('button');
  close.className = 'zoo-panel-close';
  close.type = 'button';
  close.textContent = '再想想';
  close.addEventListener('click', () => {
    overlay.remove();
    options.onCancel?.();
  });
  header.append(title, close);
  panel.appendChild(header);

  const lead = doc.createElement('p');
  lead.className = 'zoo-panel-note';
  lead.textContent = '园长递来空白条。「想好了再写。写完它就不是你的了——是下一位游客的。」';
  panel.appendChild(lead);

  const directionRow = doc.createElement('div');
  directionRow.className = 'zoo-rule-directions';
  const buttons = DIRECTIONS.map((direction) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'zoo-rule-direction';
    const label = doc.createElement('strong');
    label.textContent = direction.label;
    const hint = doc.createElement('span');
    hint.textContent = direction.hint;
    button.append(label, hint);
    button.addEventListener('click', () => select(direction.id));
    directionRow.appendChild(button);
    return button;
  });
  panel.appendChild(directionRow);

  const label = doc.createElement('label');
  label.className = 'zoo-rule-label';
  label.textContent = '第七条（可留空，使用默认文案）';
  const input = doc.createElement('input');
  input.type = 'text';
  input.className = 'zoo-rule-input';
  input.maxLength = ZOO_RULE_MAX_LENGTH;
  input.setAttribute('aria-label', '守则第七条');
  label.appendChild(input);
  panel.appendChild(label);

  const actions = doc.createElement('div');
  actions.className = 'zoo-panel-footer';
  const cancel = doc.createElement('button');
  cancel.type = 'button';
  cancel.className = 'zoo-panel-secondary';
  cancel.textContent = '再想想';
  cancel.addEventListener('click', () => {
    overlay.remove();
    options.onCancel?.();
  });
  const submit = doc.createElement('button');
  submit.type = 'button';
  submit.className = 'zoo-panel-primary';
  submit.textContent = '落笔';
  submit.addEventListener('click', () => {
    const line = input.value.trim() || ZOO_RULE_DEFAULTS[selected];
    overlay.remove();
    options.onSubmit(selected, line);
  });
  actions.append(cancel, submit);
  panel.appendChild(actions);

  let selected: ZooRuleDirection = 'keep';
  let typed = false;
  input.addEventListener('input', () => {
    typed = true;
  });

  function select(direction: ZooRuleDirection): void {
    selected = direction;
    buttons.forEach((button, index) => {
      button.classList.toggle('is-active', DIRECTIONS[index]!.id === direction);
    });
    if (!typed) input.value = ZOO_RULE_DEFAULTS[direction];
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
      options.onCancel?.();
    }
  });

  doc.body.appendChild(overlay);
  select('keep');
  input.focus();
}
