import { normalize } from './live-core.mjs';

export const regionKey = name => normalize(name).replace(/^(м\.\s*|місто\s+)/, '');

// Reject the entire snapshot instead of turning malformed/missing data into
// an empty list and accidentally announcing an all-clear.
export function validateAlertSnapshot(value) {
  if (!value || !Array.isArray(value.oblasts) || !Array.isArray(value.raions)) throw new Error('Invalid alert snapshot');
  for (const [items, district] of [[value.oblasts, false], [value.raions, true]]) {
    for (const item of items) {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || !['red', 'yellow'].includes(item.level) || (district && (typeof item.oblast !== 'string' || !item.oblast.trim()))) throw new Error('Invalid alert record');
    }
  }
  return value;
}

export function stateForRegion(snapshot, region) {
  const key = regionKey(region);
  const matches = [
    ...snapshot.oblasts.filter(a => regionKey(a.name) === key),
    ...snapshot.raions.filter(a => regionKey(a.oblast) === key),
  ];
  return matches.some(a => a.level === 'red') ? 'red' : matches.length ? 'yellow' : 'clear';
}

export function alertMessage(region, previous, state, now = Date.now()) {
  if (previous == null || previous === state) return null;
  const clear = state === 'clear';
  return {
    title: clear ? 'Відбій повітряної тривоги' : previous === 'clear' ? 'Повітряна тривога' : 'Зміна рівня тривоги',
    body: `${region}. ${clear ? 'Активних тривог в області більше немає. Дотримуйтеся офіційних вказівок.' : `Є тривога в області або її районах · ${state === 'red' ? 'червоний' : 'жовтий'} рівень. Прямуйте в укриття.`} Джерело: NEPTUN.`,
    region,
    tag: `varta-${regionKey(region)}`,
    timestamp: now,
    expiresAt: now + 120_000,
  };
}

export function validOneSignalId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
