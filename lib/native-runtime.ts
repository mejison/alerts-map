import { Capacitor } from '@capacitor/core';
import regions from './regions.json';

export const isNativeApp = () => Capacitor.isNativePlatform();

export function openNotificationRegion(region: string) {
  if (!regions.includes(region)) return;
  const url = new URL(window.location.href);
  url.searchParams.set('region', region);
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new Event('varta:open-region'));
}

export async function initializeNativeApp() {
  if (!isNativeApp()) return;
  document.documentElement.dataset.native = Capacitor.getPlatform();
  const [{ App }, { Browser }] = await Promise.all([import('@capacitor/app'), import('@capacitor/browser')]);
  await App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new Event(isActive ? 'varta:resume' : 'varta:suspend'));
  });
  await App.addListener('backButton', () => {
    if (document.querySelector('.modal-backdrop')) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    else void App.minimizeApp();
  });
  document.addEventListener('click', event => {
    const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
    if (!link) return;
    const url = new URL(link.href);
    if (url.origin === window.location.origin || !['https:', 'http:'].includes(url.protocol)) return;
    event.preventDefault();
    void Browser.open({ url: url.href });
  });
}

export async function devicePosition() {
  if (isNativeApp()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    return Geolocation.getCurrentPosition({ timeout: 10_000, enableHighAccuracy: false });
  }
  return new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 })
    : reject(new Error('Geolocation unavailable')));
}
