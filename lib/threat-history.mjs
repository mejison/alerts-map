export const HISTORY_CELL_DEGREES = 1;
export const HISTORY_MIN_SAMPLES = 12;
export const HISTORY_DELAY_MS = 24 * 60 * 60 * 1000;
export const HISTORY_RETENTION_DAYS = 30;
export const HISTORY_SAMPLE_MS = 5 * 60 * 1000;

const TRACKED_TYPES = new Set(['uav', 'fpv', 'recon']);

export function historyDayAt(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function eligibleHistoryDay(day, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const start = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(start) || historyDayAt(start) !== day) return false;
  const end = Date.parse(`${day}T23:59:59.999Z`);
  const firstRetained = Date.parse(`${historyDayAt(now)}T00:00:00.000Z`) - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return end <= now - HISTORY_DELAY_MS && end >= firstRetained;
}

export function cellKey(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 43 || lat >= 54 || lon < 20 || lon >= 42) return null;
  return `${Math.floor(lat / HISTORY_CELL_DEGREES)}:${Math.floor(lon / HISTORY_CELL_DEGREES)}`;
}

export function decodeCell(key) {
  const match = /^(-?\d+):(-?\d+)$/.exec(key);
  if (!match) return null;
  const lat = Number(match[1]), lon = Number(match[2]);
  if (!Number.isInteger(lat) || !Number.isInteger(lon) || lat < 43 || lat >= 54 || lon < 20 || lon >= 42) return null;
  return { lat, lon };
}

// Store only coarse cell counts. No target ID, exact coordinate, timestamp
// sequence, or per-target line is written to the archive.
export function aggregateThreatSamples(threats) {
  const cells = {};
  if (!Array.isArray(threats)) return cells;
  for (const threat of threats) {
    if (!threat || !TRACKED_TYPES.has(threat.type) || threat.areaOnly || threat.advisory || threat.status === 'resolved') continue;
    const key = cellKey(threat.lat, threat.lon);
    if (key) cells[key] = (cells[key] || 0) + 1;
  }
  return cells;
}

export function publicHistory(record) {
  if (!record || typeof record.day !== 'string' || !record.cells || typeof record.cells !== 'object') return [];
  return Object.entries(record.cells).flatMap(([key, samples]) => {
    const cell = decodeCell(key);
    return cell && Number.isInteger(samples) && samples >= HISTORY_MIN_SAMPLES
      ? [{ ...cell, samples }]
      : [];
  });
}
