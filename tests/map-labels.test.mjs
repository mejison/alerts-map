import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveCityLabels, CITY_LABEL_ZOOMS } from '../lib/map-labels.mjs';
import { project } from '../lib/live-core.mjs';
import { worldToView } from '../lib/map-view.mjs';

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

test('city labels are distributed across the visible map instead of clustering at its center', () => {
  const settlements = JSON.parse(readFileSync(fileURLToPath(new URL('../public/data/settlements.json', import.meta.url)), 'utf8'));
  const mapView = view(1.5);
  const labels = resolveCityLabels({ major: [], places: settlements.filter(item => item.type === 'city'), view: mapView, pixelUnits: 1 });
  const sectors = new Map();

  for (const label of labels) {
    const [x, y] = project(label.lon, label.lat);
    const position = worldToView({ x, y }, mapView);
    const column = Math.min(3, Math.floor(position.x / 1100 * 4));
    const row = Math.min(2, Math.floor(position.y / 800 * 3));
    const sector = `${column}:${row}`;
    sectors.set(sector, (sectors.get(sector) || 0) + 1);
  }

  assert.equal(labels.length, 60);
  assert.ok(sectors.size >= 9, `expected labels in at least 9 viewport sectors, got ${sectors.size}`);
  assert.ok(Math.max(...sectors.values()) <= 12, 'no single viewport sector should dominate the label selection');
});

test('major labels remain at the overview and mobile keeps its compact set', () => {
  const major = [['Київ', 30, 50], ['Тернопіль', 25, 49], ['Рівне', 26, 50]];
  const desktop = resolveCityLabels({ major, places: [], view: view(1), pixelUnits: 1 });
  const mobile = resolveCityLabels({ major, places: [], view: view(1), pixelUnits: 1, small: true });
  assert.equal(desktop.length, 3);
  assert.deepEqual(mobile.map(label => label.name), ['Київ']);
});

test('labels avoid collisions, suppress duplicate major names, and skip offscreen points', () => {
  const major = [['Опорне', 30, 50]];
  const places = [
    place('overlap', 'Інше Місто', 30, 'city'),
    place('duplicate', 'Опорне', 35, 'city'),
    place('outside', 'За Краєм', 30, 'city'),
  ];
  const labels = resolveCityLabels({ major, places, view: { zoom: 1.4, pan: { x: -5000, y: 0 } }, pixelUnits: 1 });
  assert.deepEqual(labels, []);

  const nearby = resolveCityLabels({ major, places: places.slice(0, 2), view: view(1.4), pixelUnits: 1 });
  assert.deepEqual(nearby.map(label => label.name), ['Опорне']);
});
