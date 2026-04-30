# OGA — Open Golf App

[![License: MIT](https://img.shields.io/badge/License-MIT-1D9E75.svg)](./LICENSE)

Free, open source golf tracking and improvement platform.

## What it does

- **Strokes gained tracking** vs. handicap-bracket baselines (off tee, approach, around green, putting)
- **Shot patterns** — per-club dispersion cones, miss tendency, lie-aware filtering, aim correction tips
- **AI practice plans** — drill recommendations tuned to your weakest categories (Phase 5)
- **Live round GPS tracking** on Android — Mapbox satellite view, tap for ball, long-press for aim, offline-first SQLite

## Why it exists

Everything serious in golf is paywalled. Getting better at the game shouldn't be.

## Tech stack

React + Vite (web), React Native + Expo SDK 51 (mobile, Android-first), Supabase (Postgres + auth + edge functions), TypeScript end-to-end, Mapbox for the live round map, Recharts on web and Victory Native on mobile.

## Quick start

```bash
# 1. Spin up local Supabase
npx supabase start
npx supabase db reset       # applies migrations + seed

# 2. Install + run web
pnpm install
pnpm dev --filter web       # http://localhost:5173

# 3. (Optional) Mobile dev build
cd apps/mobile && npm install
npx expo run:android        # requires a connected device or emulator
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/mobile/.env.example` to `apps/mobile/.env`, then fill in your Supabase URL + anon key (and Mapbox token if you want the live round map). For mobile device testing, the Supabase URL must be your machine's LAN IP, not `localhost`.

Optional demo data:

```bash
pnpm seed:demo              # creates demo@oga.app + 15 rounds of realistic data
```

## Self-hosting

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cner-smith/opengolfapp)

1. Create a free Supabase project, run the migrations from `supabase/migrations/` and the seed from `supabase/seed.sql`.
2. Click the Vercel button above (or `vercel deploy` locally).
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN` in Vercel's project settings.

Full step-by-step in [docs/self-hosting.md](./docs/self-hosting.md).

## Contributing

Drills, course layouts, bug fixes, and feature work all welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) — drill submissions are the highest-leverage contribution because the AI practice planner picks from this library.

## Support

OGA is free forever. If it's helped your game, consider [sponsoring the project](https://github.com/sponsors/cner-smith) to help cover server costs.

## License

[MIT](./LICENSE) — © Contributors to the OGA project.
