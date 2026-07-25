import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.runmate.mobile',
  appName: 'RunMate',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'runmate'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_runmate',
      iconColor: '#2F94D0'
    }
  }
};

export default config;
