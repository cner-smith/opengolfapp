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
