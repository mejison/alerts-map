export const MAP_WIDTH = 1100;
export const MAP_HEIGHT = 800;
export const MAP_CENTER = {x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2};
export const DEFAULT_VIEW = {zoom: 1, pan: {x: 0, y: 0}};
export const clampZoom = zoom => Math.max(.8, Math.min(4, zoom));

// Match SVG's default xMidYMid/meet sizing, including its letterboxed margins.
export function unitsPerPixel(width, height) {
  const scale = Math.min(width / MAP_WIDTH, height / MAP_HEIGHT);
  return scale > 0 ? 1 / scale : 1;
}
export function clientToMap(point, bounds) {
  const units = unitsPerPixel(bounds.width, bounds.height);
  return {
    x: (point.x - bounds.left - (bounds.width - MAP_WIDTH / units) / 2) * units,
    y: (point.y - bounds.top - (bounds.height - MAP_HEIGHT / units) / 2) * units,
  };
}
export function worldToView(point, view) {
  return {
    x: MAP_CENTER.x + view.pan.x + (point.x - MAP_CENTER.x) * view.zoom,
    y: MAP_CENTER.y + view.pan.y + (point.y - MAP_CENTER.y) * view.zoom,
  };
}
export function viewToWorld(point, view) {
  return {
    x: MAP_CENTER.x + (point.x - MAP_CENTER.x - view.pan.x) / view.zoom,
    y: MAP_CENTER.y + (point.y - MAP_CENTER.y - view.pan.y) / view.zoom,
  };
}
// The world location under the cursor must stay at that exact screen location.
export function zoomViewAt(view, requestedZoom, anchor = MAP_CENTER) {
  const zoom = clampZoom(requestedZoom);
  if (zoom === view.zoom) return view;
  return pinchViewAt(viewToWorld(anchor, view), zoom, anchor);
}
// Pinch supports both a changing distance and a moving two-finger midpoint.
export function pinchViewAt(worldAnchor, requestedZoom, midpoint) {
  const zoom = clampZoom(requestedZoom);
  return {zoom, pan: {
    x: midpoint.x - MAP_CENTER.x - (worldAnchor.x - MAP_CENTER.x) * zoom,
    y: midpoint.y - MAP_CENTER.y - (worldAnchor.y - MAP_CENTER.y) * zoom,
  }};
}
