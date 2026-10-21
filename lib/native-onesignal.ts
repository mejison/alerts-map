import type OneSignal from '@onesignal/capacitor-plugin';
import type { OneSignalSDK } from './onesignal';
import { ONESIGNAL_APP_ID } from './onesignal-config.mjs';
import { openNotificationRegion } from './native-runtime';

type Listener = () => void;
type NativeSDK = typeof OneSignal;

/** Adapt native async subscription state to the shared notification settings UI. */
export async function createNativePushAdapter(native: NativeSDK, openRegion = openNotificationRegion): Promise<OneSignalSDK> {
  let permission: NotificationPermission = 'default', id: string | null = null, optedIn = false, revision = 0;
  const subscriptionListeners = new Set<Listener>(), permissionListeners = new Set<Listener>();
  const subscription = native.User.pushSubscription;
  const refresh = async () => {
    const current = ++revision;
    const [granted, canRequest, subscriptionId, hasOptedIn, token] = await Promise.all([
      native.Notifications.hasPermission(), native.Notifications.canRequestPermission(),
      subscription.getIdAsync(), subscription.getOptedInAsync(), subscription.getTokenAsync(),
    ]);
    if (current !== revision) return;
    permission = granted ? 'granted' : canRequest ? 'default' : 'denied';
    id = subscriptionId;
    optedIn = hasOptedIn && !!token;
  };
  native.Notifications.addEventListener('click', event => {
    const region = (event.notification.additionalData as { region?: unknown } | undefined)?.region;
    if (typeof region === 'string') openRegion(region);
  });
  await native.initialize(ONESIGNAL_APP_ID);
  await refresh();
  subscription.addEventListener('change', () => {
    void refresh().then(() => { for (const listener of subscriptionListeners) listener(); }).catch(() => {});
  });
  native.Notifications.addEventListener('permissionChange', () => {
    void refresh().then(() => { for (const listener of permissionListeners) listener(); }).catch(() => {});
  });
  return {
    init: async () => {},
    getPermission: () => permission,
    Notifications: {
      isPushSupported: () => true,
      requestPermission: async () => { await native.Notifications.requestPermission(true); await refresh(); },
      addEventListener: (_event, listener) => { permissionListeners.add(listener); },
      removeEventListener: (_event, listener) => { permissionListeners.delete(listener); },
    },
    User: {
      addTags: tags => { void native.User.addTags(tags).catch(() => {}); },
      removeTags: tags => { void native.User.removeTags(tags).catch(() => {}); },
      PushSubscription: {
        get id() { return id; },
        get optedIn() { return optedIn; },
        optIn: async () => { await subscription.optIn(); await refresh(); },
        optOut: async () => { await subscription.optOut(); await refresh(); },
        addEventListener: (_event, listener) => { subscriptionListeners.add(listener); },
        removeEventListener: (_event, listener) => { subscriptionListeners.delete(listener); },
      },
    },
  };
}

export async function loadNativeOneSignal() {
  const { default: native } = await import('@onesignal/capacitor-plugin');
  return createNativePushAdapter(native);
}
