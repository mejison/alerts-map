'use client';
import { useEffect, useRef, useState } from 'react';

type PushConfig = { enabled: boolean; publicKey: string | null };
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const TOKEN = 'varta-push-token';

async function call(path: string, token: string, data: unknown, method = 'POST') {
  const response = await fetch(`/api/push/${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data),
  });
  const result = await response.json() as { error?: string; region?: string; ok?: boolean };
  if (!response.ok) throw new Error(result.error || 'Не вдалося оновити сповіщення.');
  return result;
}

export function useNotifications() {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [supported, setSupported] = useState(false), [ios, setIos] = useState(false), [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null), [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const registration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let active = true;
    const standalone = window.matchMedia('(display-mode: standalone)');
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIos(isIos);
    const updateInstalled = () => setInstalled(standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    updateInstalled(); standalone.addEventListener('change', updateInstalled);
    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', install); window.addEventListener('appinstalled', done);
    const capable = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(capable);
    if ('Notification' in window) setPermission(Notification.permission);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(async () => {
        const ready = await navigator.serviceWorker.ready;
        if (!active) return;
        registration.current = ready;
        if (!capable) return;
        const response = await fetch('/api/push/config', { cache: 'no-store' });
        if (!response.ok) throw new Error();
        const settings = await response.json() as PushConfig;
        if (!active) return;
        setConfig(settings);
        const subscription = await ready.pushManager.getSubscription(), token = localStorage.getItem(TOKEN);
        if (subscription && token && settings.enabled && Notification.permission === 'granted') {
          try {
            const status = await call('subscription', token, { action: 'status', endpoint: subscription.endpoint });
            if (active) setRegion(status.region || '');
          } catch { /* Keep the subscribe action available for re-registration. */ }
        }
      }).catch(() => { if (active) setConfig({ enabled: false, publicKey: null }); });
    } else setConfig({ enabled: false, publicKey: null });
    return () => {
      active = false; standalone.removeEventListener('change', updateInstalled);
      window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', done);
    };
  }, []);

  async function subscribe(selected: string) {
    if (busy || !selected || !config?.enabled || !config.publicKey || !registration.current) return;
    setBusy(true); setMessage(''); setError('');
    // Request permission immediately within the button gesture (required by iOS).
    let created: PushSubscription | null = null;
    try {
      const allowed = await Notification.requestPermission(); setPermission(allowed);
      if (allowed !== 'granted') throw new Error('Дозвольте сповіщення в налаштуваннях браузера для цього сайту.');
      let token = localStorage.getItem(TOKEN);
      let subscription = await registration.current.pushManager.getSubscription();
      // A lost ownership token needs a new browser subscription.
      if (subscription && !token) { await subscription.unsubscribe(); subscription = null; }
      if (!token) { token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''); localStorage.setItem(TOKEN, token); }
      if (!subscription) {
        const binary = atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/'));
        const key = Uint8Array.from(binary, character => character.charCodeAt(0));
        subscription = await registration.current.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        created = subscription;
      }
      const result = await call('subscription', token, { endpoint: subscription.endpoint, subscription: subscription.toJSON(), region: selected });
      setRegion(result.region || selected); setMessage('Підписку збережено. Повідомимо про тривогу й відбій у вашій області.');
    } catch (error) {
      if (created) await created.unsubscribe().catch(() => false);
      setError(error instanceof Error ? error.message : 'Не вдалося увімкнути сповіщення.');
    } finally { setBusy(false); }
  }

  async function unsubscribe() {
    if (busy || !registration.current) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const subscription = await registration.current.pushManager.getSubscription(), token = localStorage.getItem(TOKEN);
      if (subscription && token) await call('subscription', token, { endpoint: subscription.endpoint }, 'DELETE');
      if (subscription) await subscription.unsubscribe();
      localStorage.removeItem(TOKEN); setRegion(''); setMessage('Сповіщення на цьому пристрої вимкнено.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Не вдалося вимкнути сповіщення.'); }
    finally { setBusy(false); }
  }

  async function test() {
    if (busy || !registration.current) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const subscription = await registration.current.pushManager.getSubscription(), token = localStorage.getItem(TOKEN);
      if (!subscription || !token) throw new Error('Спочатку увімкніть сповіщення.');
      await call('test', token, { endpoint: subscription.endpoint }); setMessage('Тест надіслано. Перевірте центр сповіщень телефону.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Не вдалося надіслати тест.'); }
    finally { setBusy(false); }
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt(); await prompt.userChoice; setPrompt(null);
  }

  return { config, supported, ios, installed, canInstall: !!prompt, install, region, busy, message, error, permission, subscribe, unsubscribe, test };
}
