import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pizzarun.app',
  appName: 'Pizza Run',
  webDir: 'dist',
  backgroundColor: '#e23d28', // matches the splash, so there is no white flash while the game loads
};

export default config;
