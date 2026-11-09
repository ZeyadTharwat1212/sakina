import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.zeyad.sakina',
  appName: 'سكينة',
  webDir: 'dist',
  // Everything is bundled: no remote server, no backend.
  server: { androidScheme: 'https' },
  // Android 15+ forces edge-to-edge: keep the web view clear of the status and navigation bars
  android: { adjustMarginsForEdgeToEdge: 'auto' },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_sakina',
      iconColor: '#174B3C',
    },
  },
};

export default config;
