import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'spot-app',
  webDir: 'dist',
  android: {
    allowMixedContent: true
  }
};

export default config;
