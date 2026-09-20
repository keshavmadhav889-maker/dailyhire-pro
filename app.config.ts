import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DailyHire',
  slug: 'dailyhire',
  scheme: 'dailyhire',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#F5F2EA',
  icon: './ChatGPT Image Nov 9, 2025, 08_13_50 AM.png',
  splash: {
    image: './ChatGPT Image Nov 9, 2025, 08_13_50 AM.png',
    backgroundColor: '#0F3D2E',
    resizeMode: 'contain'
  },
  android: {
    package: 'com.dailyhire.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './ChatGPT Image Nov 9, 2025, 08_13_50 AM.png',
      backgroundColor: '#0F3D2E'
    },
    permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.POST_NOTIFICATIONS'],
    blockedPermissions: [
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION'
    ]
  },
  ios: {
    bundleIdentifier: 'com.dailyhire.app',
    supportsTablet: false,
    infoPlist: {
      NSUserTrackingUsageDescription: 'DailyHire does not track users across apps.'
    }
  },
  plugins: [
    'expo-secure-store',
    'expo-image-picker',
    'expo-notifications',
    '@react-native-firebase/app'
  ],
  updates: {
    fallbackToCacheTimeout: 0
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_FUNCTIONS_URL ?? ''
  }
});
