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
      // Foreground-only: OGA calls requestForegroundPermissionsAsync during a
      // round and never requests background/Always location. The expo-location
      // plugin below explicitly disables the Always variants (#301) so its
      // default usage strings can't re-add a permission we never use — Apple
      // rejects declaring permissions you don't request.
      NSLocationWhenInUseUsageDescription:
        'OGA uses your location during active rounds to track shot locations on the course map.',
      // No proprietary encryption beyond standard TLS/Keychain. false skips
      // Apple's export-compliance prompt on every TestFlight upload.
      ITSAppUsesNonExemptEncryption: false,
      // Stubbed pre-emptively (#305). Not used at runtime today — Expo
      // adds these automatically once expo-image-picker / expo-camera is
      // imported, but declaring them upfront prevents an App Review
      // rejection if either is added without a config bump.
      NSCameraUsageDescription:
        'OGA may use the camera to attach photos to round notes.',
      NSPhotoLibraryAddUsageDescription:
        'OGA may save round summary cards to your photo library.',
    },
    // App Privacy Manifest (required for App Store uploads since May 2024).
    // Hand-placing a PrivacyInfo.xcprivacy is futile here — CNG regenerates
    // ios/. Declared at the app level because Apple doesn't reliably parse
    // manifests bundled by static CocoaPod deps (per Expo's apple-privacy
    // guide), so the Required Reason APIs our stack touches are redeclared
    // here, verified against deps actually present: expo-sqlite (FileTimestamp/
    // DiskSpace), @react-native-async-storage (UserDefaults), react-native
    // core (SystemBootTime). NSPrivacyTracking false — no IDFA, no ad SDKs.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePreciseLocation',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
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
        // false → the plugin DELETES these keys from Info.plist
        // (@expo/config-plugins Permissions.js: `=== false` deletes). Omitting
        // them instead would fall back to the plugin's default usage string and
        // re-add the Always permission. OGA is foreground-only — see infoPlist.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
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
