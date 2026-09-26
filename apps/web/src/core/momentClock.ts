// Moment clock — which of the four day moments is "now" for a visitor. Pure
// mapping (no DOM, no image imports) so it is unit-testable in plain node and
// reusable by any view that wants to label or illustrate the current moment.
// Boundaries: 5:00–10:59 dawn · 11:00–16:59 noon · 17:00–19:59 dusk ·
// 20:00–4:59 night.

export type MomentName = 'dawn' | 'noon' | 'dusk' | 'night';

export type MomentDefinition = {
  name: MomentName;
  label: string;
  caption: string;
  /** Inclusive start hour (local time); the last moment wraps past midnight. */
  fromHour: number;
};

const MOMENTS: readonly MomentDefinition[] = [
  { name: 'dawn', label: '清晨', caption: '清晨的物实小城', fromHour: 5 },
  { name: 'noon', label: '正午', caption: '正午的物实小城', fromHour: 11 },
  { name: 'dusk', label: '黄昏', caption: '黄昏的物实小城', fromHour: 17 },
  { name: 'night', label: '夜晚', caption: '夜幕下的物实小城', fromHour: 20 },
];

// Precomputed once — momentForHour must not clone+sort on every probe.
const ORDERED_MOMENTS: readonly MomentDefinition[] = [...MOMENTS].sort((a, b) => a.fromHour - b.fromHour);

export function momentForHour(hour: number): MomentDefinition {
  // ORDERED_MOMENTS is a non-empty constant; the last entry (20:00) covers
  // deep night.
  let current: MomentDefinition = ORDERED_MOMENTS[ORDERED_MOMENTS.length - 1]!;
  for (const moment of ORDERED_MOMENTS) {
    if (hour >= moment.fromHour) current = moment;
  }
  return current;
}

export function momentForDate(date = new Date()): MomentDefinition {
  return momentForHour(date.getHours());
}
