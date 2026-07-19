import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.runmate.mobile',
  appName: 'RunMate',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_runmate',
      iconColor: '#2F94D0'
    }
  }
};

export default config;
