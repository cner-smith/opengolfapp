import type { ExpoConfig } from 'expo/config'

// Dynamic Expo config. Replaces app.json so the @rnmapbox/maps plugin can
// read MAPBOX_DOWNLOADS_TOKEN from the environment (EAS secret) at prebuild
// time — required for iOS Mapbox SDK CocoaPods fetch (Android uses a
// different distribution path and works without it).
const config: ExpoConfig = {
  name: 'OGA',
  slug: 'oga',
  scheme: 'oga',
  version: '0.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#1C211C',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'cover',
    backgroundColor: '#1C211C',
  },
  ios: {
    // Reverse-DNS mirror of the production domain (oga.golf). Bundle ID
    // is permanent once registered in App Store Connect — pick deliberately.
    bundleIdentifier: 'golf.oga.app',
    // Seed value for EAS autoIncrement on first iOS build. With
    // appVersionSource: 'remote' in eas.json, no seed = first build errors
    // because there's no remote value to increment.
    buildNumber: '1',
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'OGA uses your location during a round to track shots and yardages.',
      // App-store-review note (#301): the app only calls
      // requestForegroundPermissionsAsync(), so the Always key is inert
      // at runtime but reviewers will flag it. Removed before App Store
      // submission, kept for dev/ad-hoc builds for now.
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'OGA uses your location during a round to track shots and yardages.',
      // No proprietary encryption beyond standard TLS/Keychain.
      // false skips Apple's export-compliance prompt on every
      // TestFlight upload.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    // Android package name stays as-is — already-shipped users have this
    // identifier installed. Changing it produces a different app for them.
    package: 'app.opengolf.oga',
    softwareKeyboardLayoutMode: 'pan',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow OGA to use your location to track shots.',
      },
    ],
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsImpl: 'mapbox',
        // Secret download token for the iOS Mapbox SDK CocoaPod. Set via
        // EAS project secret: `eas secret:create --scope project --name
        // MAPBOX_DOWNLOADS_TOKEN --value sk.ey...`. Spread-conditionally
        // so local prebuild without the env var doesn't pass `undefined`
        // through to the plugin.
        ...(process.env.MAPBOX_DOWNLOADS_TOKEN
          ? { RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN }
          : {}),
      },
    ],
    'expo-font',
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: 'f852bb53-02fc-46a1-b509-4b2170cb6d84',
    },
  },
}

export default config
