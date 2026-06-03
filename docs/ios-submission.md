# iOS App Store — Submission Notes

Durable home for information App Review needs and for pre-drafted responses to
likely review questions. Mirror the relevant sections into **App Store Connect
→ App Information → App Review Information → Notes** at submission time; this
file is the source of truth that survives across submissions.

---

## Cloudflare Turnstile WebView (sign-in / sign-up)

**Why it's here:** the login and sign-up screens embed a small `WebView`
(`react-native-webview`) to render the Cloudflare Turnstile CAPTCHA challenge.
A reviewer could question WebView use under Guideline 4.2.7 (HTML5 wrappers) or
4.5.4 (sign-in flows), so a response is pre-drafted below.

**Scope (verified in code):**

- The WebView loads **only** `https://oga.golf/captcha.html` — the Turnstile
  challenge widget and nothing else (`height: 65`, `scrollEnabled={false}`).
- All authentication UI is **native React Native**: the email and password
  fields are `TextInput`s and the submit button is a `Pressable`. The WebView
  sits between the native password field and the native submit button purely to
  show the challenge.
- Source files: `apps/mobile/app/(auth)/login.tsx`,
  `apps/mobile/app/(auth)/signup.tsx`. The widget page itself is
  `apps/web/public/captcha.html`.
- The site key is URL-encoded into the widget URL (`encodeURIComponent`),
  resolved in #294.

**Pre-drafted App Review response (paste if flagged under 4.2.7 / 4.5.4):**

> The WebView in our sign-in flow is scoped exclusively to Cloudflare Turnstile,
> a CAPTCHA security control. No native iOS Turnstile SDK is available;
> Cloudflare itself documents the WebView path for mobile apps. The widget is
> the only content rendered in the WebView — all authentication UI (email,
> password fields, submit buttons) is native. This pattern is established across
> many React Native apps using Cloudflare's bot protection. The WebView does not
> gate any non-essential content.

**If rejected anyway:** escalate to the App Review Board with the response
above — high probability of acceptance. Budget one round trip in the submission
timeline.

---

## First iOS build & on-device smoke (#376)

OGA has never been built for iOS. This is the runbook to get a signed IPA onto
the test iPhone. Build host is Linux + a physical iPhone (no Mac) → builds run
on EAS Cloud and install on the device via **internal (ad-hoc) distribution**; a
simulator build is not useful here (it only runs in the macOS Simulator).

### Config status (already in place — #298/#304/#305 satisfied)
- `eas.json` — all three profiles carry iOS keys. `development`/`preview` use
  `ios.simulator: false` (device builds); `production` omits a platform key so
  it builds both OSes. **No eas.json change needed.**
- `app.config.ts` `ios` — bundle id `golf.oga.app`, `buildNumber: '1'` (seed for
  `autoIncrement` with `appVersionSource: 'remote'`), `supportsTablet`,
  `ITSAppUsesNonExemptEncryption: false` (#304), `NSLocationWhenInUseUsage…`,
  `NSCameraUsageDescription` + `NSPhotoLibraryAddUsageDescription` stubs (#305),
  full Privacy Manifest (#299), `extra.eas.projectId`.
- (The #376 issue body is stale: it cites a deleted `app.json` and bundle id
  `app.opengolf.oga` — that string is the *Android* package; iOS is `golf.oga.app`.)

### Prerequisites — needs your Apple/Expo/Mapbox accounts (cannot be done here)
1. **#297** Apple Developer Program active + App Store Connect reachable.
   (TODO: confirm #297 is closed before proceeding.)
2. `eas login` as the Expo account that owns project
   `f852bb53-02fc-46a1-b509-4b2170cb6d84`.
3. **Two Mapbox tokens must reach the EAS build** (verify, set if missing):
   - `MAPBOX_DOWNLOADS_TOKEN` — *secret* `sk.…` token, scoped with
     `DOWNLOADS:READ`, for the iOS Mapbox CocoaPod at prebuild. The
     `@rnmapbox/maps` plugin reads it from env.
     `eas secret:create --scope project --name MAPBOX_DOWNLOADS_TOKEN --value sk.…`
   - `EXPO_PUBLIC_MAPBOX_TOKEN` — *public* `pk.…` runtime token. `lib/maps.ts`
     reads it via `process.env.EXPO_PUBLIC_MAPBOX_TOKEN`; `EXPO_PUBLIC_*` is
     inlined at build time, so it must be an EAS env var (Android already needs
     it — confirm it's an EAS env, not just a local `.env`).
   - Check both: `eas env:list` / `eas secret:list`.

### Build steps (run from `apps/mobile/`)
1. Register the test iPhone for ad-hoc distribution:
   `eas device:create` → choose "register a new device" → open the URL on the
   iPhone, install the provisioning profile.
2. Kick the first build (standalone, internal — simplest first smoke; the
   `development` dev-client profile is for later JS iteration):
   `eas build --platform ios --profile preview`
   - First run is **interactive**: log into the Apple team, let EAS create the
     Distribution cert + ad-hoc provisioning profile (it includes the device
     from step 1) and register the App Store Connect app from the bundle id.
3. When the build finishes, open the EAS build URL / QR on the iPhone and
   install the IPA.

### On-device smoke checklist (#376 acceptance)
- [ ] App opens, brand splash → login screen, no cold-start crash.
- [ ] Mapbox tiles render on a live-round map (validates BOTH tokens +
      `@rnmapbox/maps` iOS config).
- [ ] Fonts: Fraunces headings render. **Known gap:** `JetBrainsMono-Medium`
      is referenced in 2 places but is **not bundled** (no font file, not in
      `useFonts` in `app/_layout.tsx`) — those mono labels fall back to the
      system font on iOS *and* Android. Cosmetic, pre-existing, not a crash.
      Decide before launch: bundle the font (OFL, add to `assets/fonts/` +
      `useFonts`) or drop the 2 `fontFamily: 'JetBrainsMono-Medium'` refs.
- [ ] VoiceOver on → navigate the rounds list, hear structured labels
      (cross-platform check of the merged a11y work).
- [ ] iOS press feedback (#303) — controls dim on press; a non-played
      scorecard hole row does NOT flash.
- [ ] Safe-area: live-round header clears the Dynamic Island; bottom sheets
      clear the home indicator (#494, merged).

### After this lands
Unblocks the rest of the device-dependent chain: #309 (store assets), #310
(listing metadata), #312 (App Review demo account), #313 (TestFlight tracks —
`eas submit` needs `submit.production` filled with Apple ID / ASC app id / team
id), #315 (@oga.golf email). `eas.json` `submit.production` is an empty stub
today; fill it at #313 with real Apple values.
