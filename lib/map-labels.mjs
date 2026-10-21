import { project } from './live-core.mjs';

const MOBILE_MAJOR_CITIES = new Set([
  'Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро', 'Луцьк', 'Ужгород',
  'Суми', 'Сімферополь', 'Донецьк', 'Херсон',
]);

const CITY_ZOOM = 1.35;
const TOWN_ZOOM = 2.1;
const BUCKET_SIZE = 16;
const LABEL_GAP = 3;

function normalizedName(name) {
  return String(name || '').trim().toLocaleLowerCase('uk');
}

function labelWidth(name, fontSize) {
  return [...name].reduce((width, character) => {
    if (character === ' ') return width + fontSize * 0.32;
    if (/[іїйІЇЙ.,'’ʼ]/u.test(character)) return width + fontSize * 0.32;
    if (/[жшщфмЖШЩФМ]/u.test(character)) return width + fontSize * 0.72;
    return width + fontSize * 0.57;
  }, 0);
}

function intersects(a, b) {
  return a.left < b.right + LABEL_GAP && a.right + LABEL_GAP > b.left &&
    a.top < b.bottom + LABEL_GAP && a.bottom + LABEL_GAP > b.top;
}

function bucketKeys(box) {
  const keys = [];
  const left = Math.floor(box.left / BUCKET_SIZE);
  const right = Math.floor(box.right / BUCKET_SIZE);
  const top = Math.floor(box.top / BUCKET_SIZE);
  const bottom = Math.floor(box.bottom / BUCKET_SIZE);
  for (let x = left; x <= right; x++) {
    for (let y = top; y <= bottom; y++) keys.push(`${x}:${y}`);
  }
  return keys;
}

/** Lay out labels across all of Ukraine. Camera movement never changes their selection. */
export function resolveCityLabels({ major, places, view, pixelUnits, small = false }) {
  const { zoom } = view;
  if (!Number.isFinite(pixelUnits) || pixelUnits <= 0 || !Number.isFinite(zoom) || zoom <= 0) return [];

  const featuredNames = new Set(major.map(([name]) => normalizedName(name)));
  const candidates = [];
  const add = (name, lon, lat, type, id) => {
    if (!name || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const [x, y] = project(lon, lat);
    // Translation does not affect collisions. Keep the nationwide layout independent
    // of the camera; SVG clips the resulting labels at the actual screen boundary.
    const layoutX = x * zoom / pixelUnits;
    const layoutY = y * zoom / pixelUnits;
    const fontSize = type === 'major' ? (name === 'Київ' ? 13 : 11) : type === 'city' ? 10 : 9;
    const box = {
      left: layoutX - 3,
      right: layoutX + 6 + labelWidth(name, fontSize),
      top: layoutY - fontSize * 0.85,
      bottom: layoutY + fontSize * 0.65,
    };
    candidates.push({ id, name, lon, lat, type, fontSize, box, priority: type === 'major' ? 0 : type === 'city' ? 1 : 2 });
  };

  for (const [name, lon, lat] of major) {
    if (!small || zoom > 1.4 || MOBILE_MAJOR_CITIES.has(name)) add(name, lon, lat, 'major', `major:${name}`);
  }

  if (zoom >= CITY_ZOOM) {
    for (const place of places) {
      const isCity = place.type === 'city';
      if (!isCity && (place.type !== 'town' || zoom < TOWN_ZOOM)) continue;
      if (featuredNames.has(normalizedName(place.name))) continue;
      add(place.name, place.lon, place.lat, place.type, place.id);
    }
  }

  candidates.sort((a, b) => a.priority - b.priority || Number(b.name === 'Київ') - Number(a.name === 'Київ') ||
    a.name.localeCompare(b.name, 'uk') || a.id.localeCompare(b.id));
  const accepted = [];
  const occupied = new Map();

  for (const candidate of candidates) {
    const keys = bucketKeys(candidate.box);
    const nearby = new Set(keys.flatMap(key => occupied.get(key) || []));
    if ([...nearby].some(index => intersects(candidate.box, accepted[index].box))) continue;
    accepted.push(candidate);
    const index = accepted.length - 1;
    for (const key of keys) {
      const bucket = occupied.get(key) || [];
      bucket.push(index);
      occupied.set(key, bucket);
    }
  }

  return accepted.map(candidate => ({
    id: candidate.id,
    name: candidate.name,
    lon: candidate.lon,
    lat: candidate.lat,
    type: candidate.type,
    fontSize: candidate.fontSize,
  }));
}

export const CITY_LABEL_ZOOMS = Object.freeze({ cities: CITY_ZOOM, towns: TOWN_ZOOM });
