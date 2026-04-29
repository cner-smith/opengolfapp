# Decisions

Append-only log of decisions that shape the project. New entries go at the bottom.

- **Client-injected Supabase client pattern (not module singleton) — Phase 2.** Reason: web uses `localStorage`, mobile uses `AsyncStorage`. The package exposes `createOgaClient(opts)`; each app owns its instance.
- **Android-first, iOS deferred — will apply in Phase 6.** Reason: Apple developer account not available.
- **No custom backend server — all server-side logic in Supabase Edge Functions.**
- **Aim point is always explicit user input, never inferred from pin or fairway center.**
- **Mapbox web wiring deferred to Phase 6 — not needed for Phase 3–5 web analytics.**
- **`node-linker=hoisted` in root `.npmrc`.** Reason: pnpm's default symlinked layout breaks the React Native Gradle plugin's `require.resolve('@react-native/gradle-plugin/package.json', { paths: [...] })` chain when EAS regenerates `android/` for the mobile app — Gradle prints the failed resolve as `null` and falls over with `Included build '.../android/null' does not exist`. Flat hoisting matches what npm/yarn produce, which is what the RN Gradle plugin expects.
