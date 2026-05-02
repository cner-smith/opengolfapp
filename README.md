# OGA — Open Golf App

[![License: MIT](https://img.shields.io/badge/License-MIT-1D9E75.svg)](./LICENSE)

Free, open source golf tracking and improvement platform.

OGA does what paid apps like Arccos, Shot Scope, and Break X Golf do — shot
tracking, strokes gained analysis, shot pattern dispersion, lie-aware
filtering — and charges nothing. The core belief: getting better at golf
shouldn't be paywalled.

## Live app

- Web: https://opengolfapp-web.vercel.app
- Android: EAS development builds today; Play Store listing TBD
- iOS: deferred — pending an Apple developer account

## Features

- **Round logging** — hole-by-hole shot entry with club, lie type, and
  split lie-slope axes (forward/back tilt + ball above/below feet).
- **Live round mode** — Android-only, GPS-assisted shot tracking.
  Mapbox satellite view, Kalman-smoothed ball position, 3-tap flow.
- **Strokes gained** — off tee, approach, around green, putting; baselines
  interpolated by handicap bracket from Mark Broadie's "Every Shot Counts".
- **Shot patterns** — per-club dispersion ellipses (68% / 95%), miss
  tendency, aim-correction tips, lie-aware filtering.
- **Course database** — ~15,870 US golf courses with GPS coordinates;
  fuzzy search backed by `pg_trgm`.
- **Handicap index** — calculated from your last N rounds against
  course rating + slope.
- **Learn section** — golf glossary and progress-focused education.
- **Putting model** — independent short/long and left/right miss axes,
  green speed, slope %, and break direction captured per putt.

A Claude-powered practice plan generator is in the roadmap (issue
tracked on GitHub) but is not yet wired up. Don't expect AI plans
to be functional today.

## Tech stack

- **Monorepo:** Turborepo + pnpm workspaces.
- **Web:** Vite + React 18 + TypeScript + Tailwind. Recharts for charts.
- **Mobile:** Expo SDK 51 + Expo Router + React Native 0.74. NativeWind
  pinned at `4.1.23`. Builds run on EAS.
- **Backend:** Supabase (Postgres + Auth + Row Level Security).
- **Maps:** Mapbox GL JS (web) + `@rnmapbox/maps` (mobile).
- **Packages:**
  - `@oga/core` — pure TypeScript: math, stats, SG calculation, Kalman GPS
    smoother, shot-pattern fitting, all shared domain types.
  - `@oga/supabase` — generated Supabase types + client factory + query
    helpers.

## Self-hosting

The short version is below. For the full walk-through (forking, Vercel
deploy, EAS setup, troubleshooting), see [docs/self-hosting.md](./docs/self-hosting.md).

### Prerequisites

- Node.js 20+
- pnpm 10+
- Supabase account (free tier is plenty)
- Mapbox account (free tier covers 50,000 map loads/month — required for
  mobile, optional for web)

### Setup

```bash
# 1. Clone
git clone https://github.com/cner-smith/opengolfapp.git
cd opengolfapp

# 2. Install dependencies
#    Mobile is decoupled from the workspace and uses npm with
#    --legacy-peer-deps; do not lift it into pnpm.
pnpm install
cd apps/mobile && npm install --legacy-peer-deps && cd ../..

# 3. Create a Supabase project at https://supabase.com
#    Copy the project URL, anon key, and service-role key.

# 4. Apply database migrations (0001–0021)
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Set up environment variables.

`apps/web/.env.local`:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_MAPBOX_TOKEN=<your-mapbox-public-token>
```

`apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_MAPBOX_TOKEN=<your-mapbox-public-token>
```

For mobile device testing, `EXPO_PUBLIC_SUPABASE_URL` must be your
machine's LAN IP (e.g. `http://192.168.1.108:54321`) when pointing at
local Supabase, not `localhost`.

### Populate the course database (optional but recommended)

The `courses` / `holes` / `course_tees` tables ship empty. The crawler
pulls golf-course outlines from OpenStreetMap (Overpass) and enriches
with tee ratings + slopes from OpenGolfAPI. Service-role only.

```bash
SUPABASE_URL=<your-url> \
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
  pnpm crawl:courses --source osm-first

# One state for a quick smoke test
pnpm crawl:courses --source osm-first --states OK

# Resume / status
pnpm crawl:courses --status
```

Full US (50 states + DC) is roughly 10–15 hours. The crawler is
resumable via the `crawl_state` table — re-run to pick up where it left
off. See the header of [`scripts/crawl-courses.ts`](./scripts/crawl-courses.ts)
for all flags.

### Run the apps

```bash
# Web (http://localhost:5173)
pnpm dev --filter web

# Mobile — Expo Metro bundler, scan the QR code with the Expo Go app
cd apps/mobile
npm run dev
```

### Build for Android (EAS)

Mobile uses Expo CNG — `android/` is regenerated on every EAS build, so
don't hand-edit native files.

```bash
cd apps/mobile
npx eas-cli build --platform android --profile development
```

Profiles in `eas.json`: `development`, `preview`, `production`.

### Run tests

```bash
pnpm typecheck   # tsc -b across the workspace
pnpm test        # Vitest in @oga/core
```

## Project structure

```
apps/
  web/              # Vite + React 18 web app
  mobile/           # Expo + React Native (Android-first)
packages/
  core/             # Pure TypeScript: math, stats, SG, Kalman, types
  supabase/         # Generated types + client factory
supabase/
  migrations/       # 0001_initial_schema.sql … 0021_shot_result_check.sql
  seed.sql          # Demo courses + drill library
scripts/
  crawl-courses.ts  # Course crawler (OSM + OpenGolfAPI)
  seed-demo.ts      # Demo user + 15 rounds of synthetic data
```

## Contributing

Drills, course data, bug fixes, and feature work all welcome. Branches
flow `feature/* → dev → main`; never push directly to `dev` or `main`.
CI must be green (typecheck + tests + web build + mobile typecheck) before
a PR is reviewed. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full
workflow and code style.

## Support OGA

OGA is free forever and runs on volunteer time + a small Supabase /
Vercel / Mapbox bill. If it's helped your game, donations cover
infrastructure costs:

[![Sponsor on GitHub](https://img.shields.io/github/sponsors/cner-smith?logo=github&logoColor=white&label=Sponsor&color=1D9E75)](https://github.com/sponsors/cner-smith) [![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-1D9E75?logo=ko-fi&logoColor=white)](https://ko-fi.com/nartana)

## License

[MIT](./LICENSE) — © Contributors to the OGA project.
