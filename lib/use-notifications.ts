'use client';
import { useEffect, useRef, useState } from 'react';
import { loadOneSignal, notificationPermission, optInOneSignal, type OneSignalSDK } from './onesignal';
import { apiFetch } from './api';
import { isNativeApp } from './native-runtime';
import { Capacitor } from '@capacitor/core';

type PushConfig = { enabled: boolean; provider: string; appId: string; native?: { ios: boolean; android: boolean } };
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const TOKEN = 'varta-push-token';

async function call(path: string, token: string, data: unknown, method = 'POST') {
  const response = await apiFetch(`/api/push/${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data),
  });
  const result = await response.json() as { error?: string; region?: string; ok?: boolean };
  if (!response.ok) throw new Error(result.error || 'Не вдалося оновити сповіщення.');
  return result;
}

export function useNotifications() {
  const native = isNativeApp();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [supported, setSupported] = useState(false), [ios, setIos] = useState(false), [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null), [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const sdk = useRef<OneSignalSDK | null>(null);

  useEffect(() => {
    let active = true, dispose = () => {};
    const standalone = window.matchMedia('(display-mode: standalone)');
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIos(isIos);
    const updateInstalled = () => setInstalled(native || standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    updateInstalled(); standalone.addEventListener('change', updateInstalled);
    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', install); window.addEventListener('appinstalled', done);
    const capable = native || (window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
    setSupported(capable);
    if ('Notification' in window) setPermission(Notification.permission);
    // The PWA cache and OneSignal use separate workers and separate scopes.
    if (!native && 'serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
    if (capable) {
      Promise.all([
        loadOneSignal(),
        apiFetch('/api/push/config', { cache: 'no-store' }).then(async response => { if (!response.ok) throw new Error('Сповіщення тимчасово недоступні.'); return response.json() as Promise<PushConfig>; }),
      ]).then(async ([oneSignal, settings]) => {
        if (!active) return;
        if (native) settings.enabled = settings.enabled && settings.native?.[Capacitor.getPlatform() as 'ios' | 'android'] === true;
        sdk.current = oneSignal; setSupported(oneSignal.Notifications.isPushSupported()); setConfig(settings);
        const changed = async () => {
          if (!active) return;
          setPermission(notificationPermission(oneSignal));
          const id = oneSignal.User.PushSubscription.id;
          if (!id || !oneSignal.User.PushSubscription.optedIn) { setRegion(''); return; }
          try {
            const token = localStorage.getItem(TOKEN);
            if (!token || !settings.enabled) return;
            const status = await call('subscription', token, { action: 'status', subscriptionId: id });
            if (active) setRegion(status.region || '');
          } catch { /* A new SDK subscription can be registered with the button. */ }
        };
        oneSignal.User.PushSubscription.addEventListener('change', changed);
        oneSignal.Notifications.addEventListener('permissionChange', changed);
        dispose = () => {
          oneSignal.User.PushSubscription.removeEventListener('change', changed);
          oneSignal.Notifications.removeEventListener('permissionChange', changed);
        };
        await changed();
      }).catch(reason => { if (active) { setConfig({ enabled: false, provider: 'OneSignal', appId: '' }); setError(reason instanceof Error ? reason.message : 'OneSignal тимчасово недоступний.'); } });
    } else setConfig({ enabled: false, provider: 'OneSignal', appId: '' });
    return () => {
      active = false; dispose(); standalone.removeEventListener('change', updateInstalled);
      window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', done);
    };
  }, [native]);

  async function subscribe(selected: string) {
    if (busy || !selected || !config?.enabled || !sdk.current) return;
    setBusy(true); setMessage(''); setError('');
    let previouslySubscribed = false;
    try {
      const oneSignal = sdk.current;
      previouslySubscribed = oneSignal.User.PushSubscription.optedIn;
      // optInOneSignal invokes the native permission prompt before any awaits.
      const subscriptionId = await optInOneSignal(oneSignal);
      setPermission(notificationPermission(oneSignal));
      let token = localStorage.getItem(TOKEN);
      if (!token) { token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''); localStorage.setItem(TOKEN, token); }
      const result = await call('subscription', token, { subscriptionId, region: selected });
      setRegion(result.region || selected);
      oneSignal.User.addTags({ varta_region: result.region || selected });
      setMessage('Підписку OneSignal збережено. Повідомимо про тривогу й відбій у вашій області.');
    } catch (reason) {
      if (!previouslySubscribed) await sdk.current.User.PushSubscription.optOut().catch(() => {});
      setError(reason instanceof Error ? reason.message : 'Не вдалося увімкнути сповіщення.');
      setPermission(notificationPermission(sdk.current));
    } finally { setBusy(false); }
  }

  async function unsubscribe() {
    if (busy || !sdk.current) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const oneSignal = sdk.current, subscriptionId = oneSignal.User.PushSubscription.id, token = localStorage.getItem(TOKEN);
      // OneSignal stops delivery even if our metadata API is temporarily down.
      await oneSignal.User.PushSubscription.optOut(); setRegion('');
      oneSignal.User.removeTags(['varta_region']);
      if (subscriptionId && token) await call('subscription', token, { subscriptionId }, 'DELETE');
      localStorage.removeItem(TOKEN); setMessage('Сповіщення OneSignal на цьому пристрої вимкнено.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не вдалося вимкнути сповіщення.'); }
    finally { setBusy(false); }
  }

  async function test() {
    if (busy || !sdk.current) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const subscriptionId = sdk.current.User.PushSubscription.id, token = localStorage.getItem(TOKEN);
      if (!subscriptionId || !token) throw new Error('Спочатку увімкніть сповіщення.');
      await call('test', token, { subscriptionId }); setMessage('Тест надіслано через OneSignal. Перевірте центр сповіщень телефону.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не вдалося надіслати тест.'); }
    finally { setBusy(false); }
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt(); await prompt.userChoice; setPrompt(null);
  }

  return { config, supported, ios, installed, native, canInstall: !!prompt, install, region, busy, message, error, permission, subscribe, unsubscribe, test };
}
