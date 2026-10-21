import { project } from './live-core.mjs';
import { worldToView } from './map-view.mjs';

const MOBILE_MAJOR_CITIES = new Set([
  'Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро', 'Луцьк', 'Ужгород',
  'Суми', 'Сімферополь', 'Донецьк', 'Херсон',
]);

const CITY_ZOOM = 1.35;
const TOWN_ZOOM = 2.1;
const MAX_CITY_LABELS = 60;
const MAX_TOWN_LABELS = 40;
const BUCKET_SIZE = 16;
const LABEL_GAP = 3;
const VIEWPORT_WIDTH = 1100;
const VIEWPORT_HEIGHT = 800;
const SECTOR_COLUMNS = 4;
const SECTOR_ROWS = 3;

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

function spreadAcrossViewport(candidates, viewportWidth, viewportHeight) {
  const sectors = Array.from({ length: SECTOR_COLUMNS * SECTOR_ROWS }, () => []);
  for (const candidate of candidates) {
    const column = Math.min(SECTOR_COLUMNS - 1, Math.floor(candidate.screenX / viewportWidth * SECTOR_COLUMNS));
    const row = Math.min(SECTOR_ROWS - 1, Math.floor(candidate.screenY / viewportHeight * SECTOR_ROWS));
    const centerX = (column + 0.5) * viewportWidth / SECTOR_COLUMNS;
    const centerY = (row + 0.5) * viewportHeight / SECTOR_ROWS;
    candidate.sectorDistance = Math.hypot(candidate.screenX - centerX, candidate.screenY - centerY);
    sectors[row * SECTOR_COLUMNS + column].push(candidate);
  }

  for (const sector of sectors) {
    sector.sort((a, b) => a.sectorDistance - b.sectorDistance || a.name.localeCompare(b.name, 'uk'));
  }

  const spread = [];
  for (let index = 0; sectors.some(sector => index < sector.length); index++) {
    for (const sector of sectors) {
      if (sector[index]) spread.push(sector[index]);
    }
  }
  return spread;
}

/** Place important labels first, then reveal smaller settlements as the map zooms in. */
export function resolveCityLabels({ major, places, view, pixelUnits, small = false }) {
  if (!Number.isFinite(pixelUnits) || pixelUnits <= 0) return [];

  const featuredNames = new Set(major.map(([name]) => normalizedName(name)));
  const viewportWidth = VIEWPORT_WIDTH / pixelUnits;
  const viewportHeight = VIEWPORT_HEIGHT / pixelUnits;
  const candidates = [];
  const add = (name, lon, lat, type, id) => {
    if (!name || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const [x, y] = project(lon, lat);
    const position = worldToView({ x, y }, view);
    const screenX = position.x / pixelUnits;
    const screenY = position.y / pixelUnits;
    const fontSize = type === 'major' ? (name === 'Київ' ? 13 : 11) : type === 'city' ? 10 : 9;
    const box = {
      left: screenX - 3,
      right: screenX + 6 + labelWidth(name, fontSize),
      top: screenY - fontSize * 0.85,
      bottom: screenY + fontSize * 0.65,
    };
    if (box.left < 0 || box.right > viewportWidth || box.top < 0 || box.bottom > viewportHeight) return;
    candidates.push({ id, name, lon, lat, type, fontSize, box, priority: type === 'major' ? 0 : type === 'city' ? 1 : 2,
      screenX, screenY });
  };

  for (const [name, lon, lat] of major) {
    if (!small || view.zoom > 1.4 || MOBILE_MAJOR_CITIES.has(name)) add(name, lon, lat, 'major', `major:${name}`);
  }

  if (view.zoom >= CITY_ZOOM || view.zoom >= TOWN_ZOOM) {
    for (const place of places) {
      const isCity = place.type === 'city';
      if (isCity && view.zoom < CITY_ZOOM) continue;
      if (!isCity && (place.type !== 'town' || view.zoom < TOWN_ZOOM)) continue;
      if (featuredNames.has(normalizedName(place.name))) continue;
      add(place.name, place.lon, place.lat, place.type, place.id);
    }
  }

  const priorityCandidates = candidates.filter(candidate => candidate.priority === 0)
    .sort((a, b) => Math.hypot(a.screenX - viewportWidth / 2, a.screenY - viewportHeight / 2) -
      Math.hypot(b.screenX - viewportWidth / 2, b.screenY - viewportHeight / 2) || a.name.localeCompare(b.name, 'uk'));
  const cityCandidates = spreadAcrossViewport(candidates.filter(candidate => candidate.priority === 1), viewportWidth, viewportHeight);
  const townCandidates = spreadAcrossViewport(candidates.filter(candidate => candidate.priority === 2), viewportWidth, viewportHeight);
  const orderedCandidates = [...priorityCandidates, ...cityCandidates, ...townCandidates];
  const accepted = [];
  const occupied = new Map();
  let cityCount = 0;
  let townCount = 0;

  for (const candidate of orderedCandidates) {
    if (candidate.type === 'city' && cityCount >= MAX_CITY_LABELS) continue;
    if (candidate.type === 'town' && townCount >= MAX_TOWN_LABELS) continue;
    const keys = bucketKeys(candidate.box);
    const nearby = new Set(keys.flatMap(key => occupied.get(key) || []));
    if ([...nearby].some(index => intersects(candidate.box, accepted[index].box))) continue;
    accepted.push(candidate);
    if (candidate.type === 'city') cityCount++;
    if (candidate.type === 'town') townCount++;
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
