import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ua.varta.alerts',
  appName: 'VARTA',
  webDir: 'dist-mobile',
  backgroundColor: '#111318',
  ios: { contentInset: 'never', handleApplicationNotifications: false },
  android: { allowMixedContent: false, backgroundColor: '#111318' },
};

export default config;
