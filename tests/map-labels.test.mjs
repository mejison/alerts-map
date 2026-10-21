import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveCityLabels, CITY_LABEL_ZOOMS } from '../lib/map-labels.mjs';

const view = zoom => ({ zoom, pan: { x: 0, y: 0 } });
const place = (id, name, lon, type) => ({ id, name, lon, lat: 50, type });

test('bundled settlement data contains valid, uniquely keyed cities and urban settlements', () => {
  const settlements = JSON.parse(readFileSync(fileURLToPath(new URL('../public/data/settlements.json', import.meta.url)), 'utf8'));
  assert.ok(settlements.length >= 2400);
  assert.ok(settlements.filter(item => item.type === 'city').length >= 450);
  assert.ok(settlements.filter(item => item.type === 'town').length >= 1900);
  assert.equal(new Set(settlements.map(item => item.id)).size, settlements.length);
  assert.ok(settlements.every(item => item.name && Number.isFinite(item.lon) && Number.isFinite(item.lat)));
});

test('larger settlement labels appear in separate zoom tiers', () => {
  const places = [place('city', 'Нове Місто', 30, 'city'), place('town', 'Велике Селище', 32, 'town')];
  assert.equal(CITY_LABEL_ZOOMS.cities, 1.35);
  assert.equal(CITY_LABEL_ZOOMS.towns, 2.1);
  assert.deepEqual(resolveCityLabels({ major: [], places, view: view(1), pixelUnits: 1 }), []);
  assert.deepEqual(resolveCityLabels({ major: [], places, view: view(1.3), pixelUnits: 1 }), []);
  assert.deepEqual(resolveCityLabels({ major: [], places, view: view(1.5), pixelUnits: 1 }).map(label => label.name), ['Нове Місто']);
  assert.deepEqual(resolveCityLabels({ major: [], places, view: view(2.2), pixelUnits: 1 }).map(label => label.name), ['Нове Місто', 'Велике Селище']);
});

test('zoom reveals cities and towns across all of Ukraine without a nationwide count limit', () => {
  const settlements = JSON.parse(readFileSync(fileURLToPath(new URL('../public/data/settlements.json', import.meta.url)), 'utf8'));
  const regions = {
    west: label => label.lon < 26,
    center: label => label.lon >= 26 && label.lon < 32,
    east: label => label.lon >= 32 && label.lon < 36,
    farEast: label => label.lon >= 36,
    crimea: label => label.lon >= 32 && label.lat < 46.2,
  };
  for (const zoom of [1.5, 2.2]) {
    const labels = resolveCityLabels({ major: [], places: settlements, view: view(zoom), pixelUnits: 1 });
    const cities = labels.filter(label => label.type === 'city');
    assert.ok(cities.length > 60, 'cities must not share a camera-wide label budget');
    const tiers = zoom >= CITY_LABEL_ZOOMS.towns ? [cities, labels.filter(label => label.type === 'town')] : [cities];
    if (tiers.length > 1) assert.ok(tiers[1].length > 40, 'towns must not share a camera-wide label budget');
    for (const tier of tiers) {
      for (const [region, matches] of Object.entries(regions)) {
        assert.ok(tier.some(matches), `missing ${tier[0]?.type} labels in ${region} at zoom ${zoom}`);
      }
    }
  }
});

test('panning never changes the nationwide label set on desktop or mobile', () => {
  const settlements = JSON.parse(readFileSync(fileURLToPath(new URL('../public/data/settlements.json', import.meta.url)), 'utf8'));
  const major = [['Київ', 30.52, 50.45], ['Львів', 24.03, 49.84], ['Луганськ', 39.31, 48.57]];
  for (const pixelUnits of [1, 2.8]) {
    for (const zoom of [1.5, 2.2, 4]) {
      const options = { major, places: settlements, view: view(zoom), pixelUnits, small: pixelUnits > 1 };
      const nationwide = resolveCityLabels(options);
      for (const pan of [{ x: -600, y: 400 }, { x: 600, y: -400 }, { x: -5000, y: 0 }]) {
        assert.deepEqual(resolveCityLabels({ ...options, view: { zoom, pan } }), nationwide);
      }
    }
  }
});

test('major labels remain at the overview and mobile keeps its compact set', () => {
  const major = [['Київ', 30, 50], ['Тернопіль', 25, 49], ['Рівне', 26, 50]];
  const desktop = resolveCityLabels({ major, places: [], view: view(1), pixelUnits: 1 });
  const mobile = resolveCityLabels({ major, places: [], view: view(1), pixelUnits: 1, small: true });
  assert.equal(desktop.length, 3);
  assert.deepEqual(mobile.map(label => label.name), ['Київ']);
});

test('labels avoid collisions and suppress duplicate major names without camera clipping', () => {
  const major = [['Опорне', 30, 50]];
  const places = [
    place('overlap', 'Інше Місто', 30, 'city'),
    place('duplicate', 'Опорне', 35, 'city'),
    place('outside', 'За Краєм', 30, 'city'),
  ];
  const nearby = resolveCityLabels({ major, places, view: view(1.4), pixelUnits: 1 });
  assert.deepEqual(nearby.map(label => label.name), ['Опорне']);
  const outsideCamera = resolveCityLabels({ major, places, view: { zoom: 1.4, pan: { x: -5000, y: 0 } }, pixelUnits: 1 });
  assert.deepEqual(outsideCamera, nearby);
});
