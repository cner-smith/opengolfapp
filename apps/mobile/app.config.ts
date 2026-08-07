import type { ExpoConfig } from 'expo/config'

// Dynamic Expo config. Replaces app.json for Mapbox plugin setup and
// runtime configuration.
const config: ExpoConfig = {
  name: 'OGA',
  slug: 'oga',
  scheme: 'oga',
  version: '1.2.0',
  // EAS Update (OTA). Ships JS/asset-only fixes to installed builds WITHOUT an
  // App Store / Play review — Apple/Google permit interpreted-code updates that
  // don't add native code or change the app's purpose. Native changes (SDK/RN
  // bumps, new modules, permission or icon changes) still need a new reviewed
  // binary — bump `version` when you ship one so the OTA runtimeVersion moves
  // with it (see policy note below). Channels → update branches are set
  // per-profile in eas.json. NOTE: the FIRST expo-updates build must be
  // submitted + approved once before OTA is live (the already-shipped store
  // build has no updates runtime).
  updates: {
    url: 'https://u.expo.dev/f852bb53-02fc-46a1-b509-4b2170cb6d84',
  },
  // `appVersion`, NOT `fingerprint`. The fingerprint policy makes EAS recompute
  // a native fingerprint on its build servers ("Configure expo-updates" phase),
  // which diverges/fails in a monorepo where node_modules/lockfile resolution
  // differs server-side vs local — worse with expo-sqlite present (both true
  // here). It failed both prod builds 2026-07-07 with an opaque "Unknown error";
  // fingerprint computed fine locally but not on EAS. See expo/expo#43831 (open,
  // no upstream fix). appVersion derives runtimeVersion from `version` (1.0.0),
  // computed identically local + on EAS — OTA is fully retained; just remember
  // to bump `version` on any release that changes native code.
  runtimeVersion: {
    policy: 'appVersion',
  },
  orientation: 'portrait',
  // New Architecture is ON — required by Reanimated 4 + rnmapbox >=10.3, and
  // mandatory from SDK 55 on. 16 KB does NOT require New Arch (it's the RN
  // 0.77+/NDK r27 toolchain, already satisfied) — this flip is purely to
  // unblock Reanimated 4 / rnmapbox's New-Arch-only path. See #467.
  newArchEnabled: true,
  // Direction A "o." monogram (brand-mark Issue 03) — flat 1024² master;
  // iOS clips the squircle, so no baked corners. Universal fallback used by
  // Android (which also has adaptiveIcon below) and web. iOS light/dark/
  // tinted variants are wired via ios.icon below (#499, unblocked on SDK 52).
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#1C211C',
  // Splash is configured via the expo-splash-screen plugin below (SDK 53
  // deprecates the top-level `splash` key). See the plugins array.
  ios: {
    // Reverse-DNS mirror of the production domain (oga.golf). Bundle ID
    // is permanent once registered in App Store Connect — pick deliberately.
    bundleIdentifier: 'golf.oga.app',
    // iOS app-icon variants (#499). SDK 52+ accepts an object form; light is
    // the standard "o." mark, dark drops the paper background for iOS dark
    // appearance, tinted is the monochrome grayscale Apple recolors. All three
    // are 1024² masters staged in assets/.
    icon: {
      light: './assets/icon.png',
      dark: './assets/icon-dark.png',
      tinted: './assets/icon-tinted.png',
    },
    // buildNumber / versionCode are managed remotely by EAS (appVersionSource:
    // 'remote' + autoIncrement in eas.json) now that a remote value exists — no
    // local seed. (A seed was only needed for the very first build, before EAS
    // had a value to increment.)
    // iPhone-only for v1: drops the App Store's 12.9" iPad screenshot
    // requirement and iPad-layout QA. Revisit when an iPad layout is on the roadmap.
    supportsTablet: false,
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
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F2EEE5',
    },
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
    'expo-sqlite',
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
      },
    ],
    'expo-font',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        // contain + ink backgroundColor: the asset is the paper "o." mark on a
        // transparent field, so the fill frames the centred mark whole on any
        // aspect ratio (rather than cropping it to cover).
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#1C211C',
        // SDK 52+ Android renders the splash image as a centred icon (Android-12
        // SplashScreen API). Keep the prior full-screen `contain` rendering so
        // this migration is visually identical — adopting the centred-icon model
        // is a deliberate design follow-up, not a silent migration side effect.
        enableFullScreenImage_legacy: true,
      },
    ],
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
