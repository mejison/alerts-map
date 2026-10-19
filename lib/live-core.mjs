export const BASE = 'https://neptun.in.ua';
export const normalize = (s = '') => s.toLowerCase().replace(/область|район/g, '').replace(/[’'ʼ]/g, '').replace(/\s+/g, ' ').trim();
export function validThreat(t) {
  return t && typeof t.id === 'string' && typeof t.type === 'string' && typeof t.title === 'string' && Number.isFinite(t.lat) && Number.isFinite(t.lon) && Math.abs(t.lat) <= 90 && Math.abs(t.lon) <= 180 && typeof t.updatedAt === 'string' && Number.isFinite(Date.parse(t.updatedAt));
}
export function parseAlerts(data) {
  const clean = (list) => Array.isArray(list) ? list.filter(a => a && typeof a.key === 'string' && typeof a.name === 'string').map(a => ({ ...a, level: a.level === 'yellow' ? 'yellow' : 'red' })) : [];
  return { raions: clean(data?.raions), oblasts: clean(data?.oblasts) };
}
export function reduceThreats(current, frame) {
  if (frame.type === 'snapshot') return Array.isArray(frame.data?.threats) ? frame.data.threats.filter(validThreat) : current;
  if (frame.type === 'upsert' && validThreat(frame.data)) return [...current.filter(t => t.id !== frame.data.id), frame.data];
  if (frame.type === 'remove' && typeof frame.data?.id === 'string') return current.filter(t => t.id !== frame.data.id);
  return current;
}
export function canPlot(t) { return validThreat(t) && !t.areaOnly && t.status !== 'resolved'; }
export function canShowHeading(t) { return canPlot(t) && Number.isFinite(t.heading) && ['high', 'medium'].includes(t.displayConfidence || t.confidenceLevel); }
// A Mercator projection preserves the familiar geographic shape of Ukraine.
export function project(lon, lat) {
  // Browser and Worker math libraries may differ at the last binary digit.
  // Quantize SVG coordinates so the first client render matches server HTML.
  const stable = value => Math.round(value * 1000) / 1000;
  return [stable((lon - 21.1) * 52.4), stable((1.102 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) * 3000)];
}
export function geometryPath(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map(p => p.map(r => r.map((c, i) => { const [x, y] = project(c[0], c[1]); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join('') + 'Z').join('')).join('');
}
