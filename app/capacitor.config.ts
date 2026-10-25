import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.zeyad.sakina',
  appName: 'سكينة',
  webDir: 'dist',
  // Everything is bundled: no remote server, no backend.
  server: { androidScheme: 'https' },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_sakina',
      iconColor: '#174B3C',
    },
  },
};

export default config;
