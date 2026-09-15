import assert from 'node:assert/strict';
import test from 'node:test';
import { createNpcDistrictFilter } from '../../src/city/npcDistrictFilter';

test('npc district filter updates active button and notifies change', () => {
  const buttons = [
    { dataset: { filter: 'all' }, classList: { active: true, toggle(token: string, force?: boolean) { if (token === 'active') this.active = Boolean(force); return this.active; } } },
    { dataset: { filter: 'friends' }, classList: { active: false, toggle(token: string, force?: boolean) { if (token === 'active') this.active = Boolean(force); return this.active; } } },
  ];
  const toasts: string[] = [];
  const changes: string[] = [];
  const filter = createNpcDistrictFilter({
    queryButtons: () => buttons,
    onChange: (value) => changes.push(value),
    showToast: (message) => toasts.push(message),
  });

  const allButton = buttons[0]!;
  const friendsButton = buttons[1]!;
  filter.setFilter('friends');

  assert.equal(filter.get(), 'friends');
  assert.equal(allButton.classList.active, false);
  assert.equal(friendsButton.classList.active, true);
  assert.deepEqual(changes, ['friends']);
  assert.deepEqual(toasts, ['no friends online yet — invite someone!']);
});
