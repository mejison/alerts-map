import { ONESIGNAL_APP_ID, ONESIGNAL_SDK_URL } from './onesignal-config.mjs';

type Listener = () => void;
type DeferredCallback = (sdk: OneSignalSDK) => void | Promise<void>;
export type OneSignalSDK = {
  init: (options: Record<string, unknown>) => Promise<void>;
  Notifications: {
    requestPermission: () => Promise<void>;
    isPushSupported: () => boolean;
    addEventListener: (event: string, listener: Listener) => void;
    removeEventListener: (event: string, listener: Listener) => void;
  };
  User: {
    addTags: (tags: Record<string, string>) => void;
    removeTags: (tags: string[]) => void;
    PushSubscription: {
      id: string | null;
      optedIn: boolean;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
      addEventListener: (event: 'change', listener: Listener) => void;
      removeEventListener: (event: 'change', listener: Listener) => void;
    };
  };
};
declare global {
  interface Window { OneSignalDeferred?: { push: (callback: DeferredCallback) => unknown } }
}

let initialization: Promise<OneSignalSDK> | null = null;
export function loadOneSignal(): Promise<OneSignalSDK> {
  if (initialization) return initialization;
  initialization = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OneSignal не відповідає. Перевірте мережу або блокувальник реклами.')), 20_000);
    const deferred = window.OneSignalDeferred || ([] as DeferredCallback[]);
    window.OneSignalDeferred = deferred;
    deferred.push(async sdk => {
      try {
        await sdk.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/push/onesignal/' },
          notifyButton: { enable: false },
          welcomeNotification: { disable: true },
          promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
          autoResubscribe: false,
          notificationClickHandlerMatch: 'origin',
          notificationClickHandlerAction: 'navigate',
        });
        clearTimeout(timer); resolve(sdk);
      } catch {
        clearTimeout(timer); reject(new Error('Не вдалося підключити OneSignal. Перевірте адресу сайту в налаштуваннях OneSignal.'));
      }
    });
    if (!document.getElementById('onesignal-sdk')) {
      const script = document.createElement('script');
      script.id = 'onesignal-sdk'; script.src = ONESIGNAL_SDK_URL; script.defer = true;
      script.onerror = () => { clearTimeout(timer); reject(new Error('Не вдалося завантажити OneSignal. Перевірте блокувальник реклами.')); };
      document.head.appendChild(script);
    }
  });
  return initialization;
}

export async function optInOneSignal(sdk: OneSignalSDK): Promise<string> {
  // This call happens immediately in the user's button gesture, before awaits.
  await sdk.Notifications.requestPermission();
  if (Notification.permission !== 'granted') throw new Error('Дозвольте сповіщення в налаштуваннях браузера для цього сайту.');
  await sdk.User.PushSubscription.optIn();
  const subscription = sdk.User.PushSubscription;
  if (subscription.id && subscription.optedIn) return subscription.id;
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); subscription.removeEventListener('change', changed); };
    const changed = () => { if (subscription.id && subscription.optedIn) { cleanup(); resolve(subscription.id); } };
    const timer = setTimeout(() => { cleanup(); reject(new Error('OneSignal ще реєструє пристрій. Спробуйте ще раз.')); }, 15_000);
    subscription.addEventListener('change', changed); changed();
  });
}
