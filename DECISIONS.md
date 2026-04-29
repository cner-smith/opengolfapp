# Decisions

Append-only log of decisions that shape the project. New entries go at the bottom.

- **Client-injected Supabase client pattern (not module singleton) — Phase 2.** Reason: web uses `localStorage`, mobile uses `AsyncStorage`. The package exposes `createOgaClient(opts)`; each app owns its instance.
- **Android-first, iOS deferred — will apply in Phase 6.** Reason: Apple developer account not available.
- **No custom backend server — all server-side logic in Supabase Edge Functions.**
- **Aim point is always explicit user input, never inferred from pin or fairway center.**
- **Mapbox web wiring deferred to Phase 6 — not needed for Phase 3–5 web analytics.**
