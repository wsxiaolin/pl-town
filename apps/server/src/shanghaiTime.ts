// Intl.DateTimeFormat construction is expensive and shanghaiDayKey runs on
// every progress read, so build the formatter once per process.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function shanghaiDayKey(at = new Date()): string {
  return dayFormatter.format(at);
}

export function previousDayKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid Shanghai day key');
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
