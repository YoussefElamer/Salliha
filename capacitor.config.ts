import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salliha.app',
  appName: 'صَلِّها',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: false,
    captureInput: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#1f6f62',
      showSpinner: false
    }
  }
};

export default config;
