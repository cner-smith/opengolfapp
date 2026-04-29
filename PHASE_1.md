# Phase 1 — Repo + infrastructure setup

## Goal
Stand up a fully working monorepo with Turborepo, initialize all apps and packages, configure Supabase with the full schema, set up auth, and get CI running. At the end of this phase you should be able to run `pnpm dev` and see both the web and mobile apps boot, and be able to sign up / sign in via Supabase auth.

## Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Supabase CLI (`npm install -g supabase`)
- Expo CLI (`npm install -g expo-cli`)
- A Supabase account (supabase.com) — create a new project named `oga`
- A Mapbox account (mapbox.com) — create a public token
- An Anthropic API key (console.anthropic.com)

---

## Step 1 — Initialize the monorepo

```bash
mkdir oga && cd oga
git init
pnpm init
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Create `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["SUPABASE_URL", "SUPABASE_ANON_KEY", "MAPBOX_TOKEN"],
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

Root `package.json`:
```json
{
  "name": "oga",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.4.0",
    "prettier": "^3.2.0"
  }
}
```

---

## Step 2 — Create the packages

### `packages/core`

```bash
mkdir -p packages/core/src
```

`packages/core/package.json`:
```json
{
  "name": "@oga/core",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

`packages/core/src/index.ts` — export barrel (populate as we build):
```ts
export * from './types'
export * from './sg-baselines'
export * from './sg-calculator'
export * from './constants'
```

`packages/core/src/constants.ts`:
```ts
export const CLUBS = [
  'driver', '3w', '5w', '7w',
  '3h', '4h', '5h',
  '2i', '3i', '4i', '5i', '6i', '7i', '8i', '9i',
  'pw', 'gw', 'sw', 'lw',
  'putter'
] as const

export const LIE_TYPES = [
  'tee', 'fairway', 'rough', 'sand', 'fringe', 'recovery', 'green'
] as const

export const LIE_SLOPES = [
  'level', 'uphill', 'downhill', 'ball_above', 'ball_below'
] as const

export const SHOT_RESULTS = [
  'solid', 'push_right', 'pull_left', 'fat', 'thin', 'shank', 'topped', 'penalty', 'ob'
] as const

export const SKILL_LEVELS = [
  'beginner', 'casual', 'developing', 'competitive'
] as const

export const GOALS = [
  'break_100', 'break_90', 'break_80', 'break_70s', 'scratch'
] as const

export const FACILITIES = [
  'range', 'short_game', 'putting', 'sim'
] as const

export type Club = typeof CLUBS[number]
export type LieType = typeof LIE_TYPES[number]
export type LieSlope = typeof LIE_SLOPES[number]
export type ShotResult = typeof SHOT_RESULTS[number]
export type SkillLevel = typeof SKILL_LEVELS[number]
export type Goal = typeof GOALS[number]
export type Facility = typeof FACILITIES[number]
```

`packages/core/src/types.ts` — core domain types:
```ts
import type { Club, LieType, LieSlope, ShotResult, SkillLevel, Goal, Facility } from './constants'

export interface Profile {
  id: string
  username: string
  handicapIndex: number
  skillLevel: SkillLevel
  goal: Goal
  playFrequency: string
  facilities: Facility[]
  playStyle: 'casual' | 'mixed' | 'competitive'
  createdAt: string
}

export interface Course {
  id: string
  name: string
  location?: string
  mapboxId?: string
}

export interface Hole {
  id: string
  courseId: string
  number: number
  par: number
  yards?: number
  strokeIndex?: number
  teeLat?: number
  teeLng?: number
  pinLat?: number
  pinLng?: number
}

export interface Round {
  id: string
  userId: string
  courseId: string
  playedAt: string
  teeColor?: string
  totalScore?: number
  totalPutts?: number
  fairwaysHit?: number
  fairwaysTotal?: number
  gir?: number
  sgOffTee?: number
  sgApproach?: number
  sgAroundGreen?: number
  sgPutting?: number
  sgTotal?: number
  notes?: string
}

export interface HoleScore {
  id: string
  roundId: string
  holeId: string
  score: number
  putts?: number
  fairwayHit?: boolean
  gir?: boolean
  sgOffTee?: number
  sgApproach?: number
  sgAroundGreen?: number
  sgPutting?: number
}

export interface Shot {
  id: string
  holeScoreId: string
  userId: string
  shotNumber: number
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
  aimLat?: number
  aimLng?: number
  distanceToTarget?: number
  club?: Club
  lieType?: LieType
  lieSlope?: LieSlope
  shotResult?: ShotResult
  penalty?: boolean
  ob?: boolean
  aimOffsetYards?: number
  breakDirection?: 'left' | 'right' | 'straight'
  puttResult?: 'made' | 'short' | 'long' | 'missed_left' | 'missed_right'
  puttDistanceFt?: number
  notes?: string
}

export interface SGBreakdown {
  offTee: number
  approach: number
  aroundGreen: number
  putting: number
  total: number
}

export interface PracticePlan {
  id: string
  userId: string
  generatedAt: string
  validUntil: string
  basedOnRounds: number
  focusAreas: FocusArea[]
  drills: PlanDrill[]
  aiInsight: string
  completedDrillIds: string[]
}

export interface FocusArea {
  category: 'off_tee' | 'approach' | 'around_green' | 'putting'
  priority: number
  sgValue: number
  insight: string
}

export interface PlanDrill {
  drillId: string
  name: string
  durationMin: number
  facility: string
  category: string
  description: string
  reason: string
}

export interface Drill {
  id: string
  name: string
  description: string
  durationMin: number
  category: string
  facility: string[]
  skillLevels: SkillLevel[]
  instructions: string
}
```

`packages/core/src/sg-baselines.ts` — expected strokes to hole:
```ts
// Expected strokes to hole from distance by handicap bracket
// Source: Adapted from Mark Broadie's research + amateur data
// Distance in yards for approach/around-green, feet for putting

export type HandicapBracket = 0 | 5 | 10 | 15 | 20 | 25 | 30

export const PUTTING_BASELINES: Record<HandicapBracket, Record<number, number>> = {
  0:  { 3: 1.03, 5: 1.14, 8: 1.30, 10: 1.37, 15: 1.55, 20: 1.70, 30: 1.88, 40: 2.00, 60: 2.18 },
  5:  { 3: 1.05, 5: 1.18, 8: 1.38, 10: 1.47, 15: 1.68, 20: 1.85, 30: 2.03, 40: 2.16, 60: 2.34 },
  10: { 3: 1.07, 5: 1.22, 8: 1.44, 10: 1.56, 15: 1.80, 20: 1.98, 30: 2.18, 40: 2.32, 60: 2.50 },
  15: { 3: 1.10, 5: 1.27, 8: 1.52, 10: 1.65, 15: 1.92, 20: 2.12, 30: 2.34, 40: 2.48, 60: 2.66 },
  20: { 3: 1.13, 5: 1.33, 8: 1.62, 10: 1.76, 15: 2.05, 20: 2.27, 30: 2.50, 40: 2.65, 60: 2.84 },
  25: { 3: 1.17, 5: 1.40, 8: 1.73, 10: 1.88, 15: 2.20, 20: 2.44, 30: 2.68, 40: 2.83, 60: 3.02 },
  30: { 3: 1.22, 5: 1.48, 8: 1.86, 10: 2.02, 15: 2.37, 20: 2.62, 30: 2.88, 40: 3.04, 60: 3.24 },
}

export const APPROACH_BASELINES: Record<HandicapBracket, Record<number, number>> = {
  0:  { 50: 2.60, 75: 2.72, 100: 2.85, 125: 2.98, 150: 3.12, 175: 3.24, 200: 3.35, 225: 3.45 },
  5:  { 50: 2.75, 75: 2.90, 100: 3.05, 125: 3.20, 150: 3.36, 175: 3.50, 200: 3.63, 225: 3.75 },
  10: { 50: 2.92, 75: 3.10, 100: 3.28, 125: 3.46, 150: 3.64, 175: 3.80, 200: 3.95, 225: 4.08 },
  15: { 50: 3.10, 75: 3.32, 100: 3.54, 125: 3.74, 150: 3.95, 175: 4.13, 200: 4.29, 225: 4.44 },
  20: { 50: 3.30, 75: 3.56, 100: 3.82, 125: 4.05, 150: 4.28, 175: 4.48, 200: 4.66, 225: 4.82 },
  25: { 50: 3.52, 75: 3.82, 100: 4.12, 125: 4.38, 150: 4.63, 175: 4.85, 200: 5.05, 225: 5.22 },
  30: { 50: 3.76, 75: 4.10, 100: 4.44, 125: 4.74, 150: 5.01, 175: 5.25, 200: 5.47, 225: 5.66 },
}

export const AROUND_GREEN_BASELINES: Record<HandicapBracket, Record<number, number>> = {
  0:  { 5: 2.18, 10: 2.30, 15: 2.40, 20: 2.52, 30: 2.64 },
  5:  { 5: 2.30, 10: 2.44, 15: 2.56, 20: 2.70, 30: 2.84 },
  10: { 5: 2.44, 10: 2.60, 15: 2.74, 20: 2.90, 30: 3.06 },
  15: { 5: 2.60, 10: 2.78, 15: 2.94, 20: 3.12, 30: 3.30 },
  20: { 5: 2.78, 10: 2.98, 15: 3.16, 20: 3.36, 30: 3.56 },
  25: { 5: 2.98, 10: 3.20, 15: 3.40, 20: 3.62, 30: 3.84 },
  30: { 5: 3.20, 10: 3.44, 15: 3.66, 20: 3.90, 30: 4.14 },
}

export function getHandicapBracket(handicap: number): HandicapBracket {
  if (handicap <= 2) return 0
  if (handicap <= 7) return 5
  if (handicap <= 12) return 10
  if (handicap <= 17) return 15
  if (handicap <= 22) return 20
  if (handicap <= 27) return 25
  return 30
}

export function interpolateBaseline(
  table: Record<number, number>,
  distance: number
): number {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b)
  const lower = keys.filter(k => k <= distance).at(-1)
  const upper = keys.find(k => k > distance)
  if (lower === undefined) return table[keys[0]]
  if (upper === undefined) return table[keys[keys.length - 1]]
  const ratio = (distance - lower) / (upper - lower)
  return table[lower] + ratio * (table[upper] - table[lower])
}
```

`packages/core/src/sg-calculator.ts`:
```ts
import {
  getHandicapBracket,
  interpolateBaseline,
  PUTTING_BASELINES,
  APPROACH_BASELINES,
  AROUND_GREEN_BASELINES
} from './sg-baselines'
import type { Shot } from './types'

type ShotCategory = 'off_tee' | 'approach' | 'around_green' | 'putting'

export function getShotCategory(shot: Shot, par: number, shotNumber: number): ShotCategory {
  if (shot.lieType === 'green') return 'putting'
  if (shot.distanceToTarget !== undefined && shot.distanceToTarget <= 30) return 'around_green'
  if (shotNumber === 1 && (par === 4 || par === 5)) return 'off_tee'
  return 'approach'
}

export function getExpectedStrokes(
  category: ShotCategory,
  distanceYards: number | undefined,
  distanceFt: number | undefined,
  handicap: number
): number | null {
  const bracket = getHandicapBracket(handicap)
  if (category === 'putting' && distanceFt !== undefined) {
    return interpolateBaseline(PUTTING_BASELINES[bracket], distanceFt)
  }
  if (category === 'around_green' && distanceYards !== undefined) {
    return interpolateBaseline(AROUND_GREEN_BASELINES[bracket], distanceYards)
  }
  if ((category === 'approach' || category === 'off_tee') && distanceYards !== undefined) {
    return interpolateBaseline(APPROACH_BASELINES[bracket], distanceYards)
  }
  return null
}

export function calculateShotSG(
  startExpected: number,
  endExpected: number
): number {
  // SG = expected strokes from start - expected strokes from end - 1
  return startExpected - endExpected - 1
}
```

---

### `packages/supabase`

```bash
mkdir -p packages/supabase/src
```

`packages/supabase/package.json`:
```json
{
  "name": "@oga/supabase",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "gen-types": "supabase gen types typescript --local > src/types.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

`packages/supabase/src/client.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env?.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? import.meta.env?.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

`packages/supabase/src/index.ts`:
```ts
export { supabase } from './client'
export type { Database } from './types'
```

Note: `src/types.ts` is generated by the Supabase CLI — do not write it by hand. Run `pnpm gen-types` from this package after the schema is applied.

---

## Step 3 — Initialize the web app

```bash
mkdir -p apps/web
cd apps/web
pnpm create vite . --template react-ts
pnpm install
pnpm install -D tailwindcss postcss autoprefixer
pnpm install @supabase/supabase-js @supabase/auth-ui-react @supabase/auth-ui-shared
pnpm install react-router-dom
pnpm install @oga/core @oga/supabase
```

Initialize Tailwind:
```bash
npx tailwindcss init -p
```

`apps/web/package.json` — add to scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview"
  }
}
```

`apps/web/.env.local` (create this file, do not commit):
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_TOKEN=your_mapbox_token
```

### Web app structure
```
apps/web/src/
  main.tsx
  App.tsx
  router.tsx
  pages/
    auth/
      LoginPage.tsx
      SignupPage.tsx
    onboarding/
      OnboardingPage.tsx
    dashboard/
      DashboardPage.tsx
    rounds/
      RoundsPage.tsx
      RoundDetailPage.tsx
      NewRoundPage.tsx
    stats/
      StrokesGainedPage.tsx
    patterns/
      ShotPatternsPage.tsx
    practice/
      PracticePlanPage.tsx
      DrillLibraryPage.tsx
  components/
    layout/
      Sidebar.tsx
      AppShell.tsx
    auth/
      AuthGuard.tsx
    ui/           (shadcn components go here)
  hooks/
    useAuth.ts
    useProfile.ts
    useRounds.ts
  lib/
    supabase.ts   (re-export from @oga/supabase with web env vars)
```

### Auth setup (`apps/web/src/hooks/useAuth.ts`):
```ts
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
```

### AuthGuard (`apps/web/src/components/auth/AuthGuard.tsx`):
```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

---

## Step 4 — Initialize the mobile app

```bash
cd apps
npx create-expo-app mobile --template expo-template-blank-typescript
cd mobile
pnpm install nativewind tailwindcss
pnpm install @supabase/supabase-js
pnpm install expo-location
pnpm install @rnmapbox/maps
pnpm install @oga/core @oga/supabase
```

`apps/mobile/app.json` — ensure `expo.scheme` is set to `oga` for deep links.

`apps/mobile/.env` (do not commit):
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

### Mobile app structure
```
apps/mobile/
  app/              (Expo Router file-based routing)
    _layout.tsx
    index.tsx       (redirects to dashboard or auth)
    (auth)/
      login.tsx
      signup.tsx
    (app)/
      _layout.tsx   (tab navigator)
      index.tsx     (dashboard)
      round/
        new.tsx
        [id]/
          index.tsx
          hole/[number].tsx
      stats.tsx
      patterns.tsx
      practice.tsx
      profile.tsx
  components/
    round/
      HoleMap.tsx
      ShotLogger.tsx
      ClubSelector.tsx
      LieSelector.tsx
      SlopeGrid.tsx
    ui/
  hooks/
  lib/
```

---

## Step 5 — Supabase schema + migrations

```bash
cd oga  # project root
npx supabase init
npx supabase start  # starts local Postgres + Studio
```

Create `supabase/migrations/0001_initial_schema.sql` with the full schema from `CLAUDE.md`. Key points:
- Enable `uuid-ossp` extension
- Create all tables in order (profiles → courses → holes → rounds → hole_scores → shots → drills → practice_plans)
- Add all foreign keys
- Enable RLS on every user-owned table
- Create RLS policies

### RLS policies to create
```sql
-- profiles
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- rounds
create policy "Users can CRUD own rounds" on rounds for all using (auth.uid() = user_id);

-- hole_scores
create policy "Users can CRUD own hole scores" on hole_scores for all
  using (exists (select 1 from rounds where rounds.id = hole_scores.round_id and rounds.user_id = auth.uid()));

-- shots
create policy "Users can CRUD own shots" on shots for all using (auth.uid() = user_id);

-- practice_plans
create policy "Users can CRUD own plans" on practice_plans for all using (auth.uid() = user_id);

-- courses, holes, drills — public read
create policy "Anyone can read courses" on courses for select using (true);
create policy "Anyone can read holes" on holes for select using (true);
create policy "Anyone can read drills" on drills for select using (true);
```

### Profile creation trigger
Create a trigger to auto-create a profile row when a new user signs up:
```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

After applying migrations, generate types:
```bash
cd packages/supabase
pnpm gen-types
```

---

## Step 6 — GitHub Actions CI

Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm test
```

---

## Step 7 — Seed data

Create `supabase/seed.sql` with:
- 5–10 sample courses with holes (use real course data or made-up)
- 20+ drills covering all categories and skill levels
- Sample data is critical — without drills the AI plan generator has nothing to reference

Sample drill seed format:
```sql
insert into drills (name, description, duration_min, category, facility, skill_levels, instructions)
values
  ('9-shot grid', 'Hit 9 shots to a target, varying shape and trajectory in a 3x3 grid', 15, 'approach', '{range}', '{developing,competitive}', 'Pick a target 150 yards away. Hit 3 draws, 3 straight shots, and 3 fades. Track where each lands relative to your aim point.'),
  ('Gate drill', 'Place two alignment sticks 1 yard apart at your target distance as a gate to hit through', 20, 'approach', '{range}', '{developing,competitive}', 'Set up two alignment sticks or range baskets 1 yard apart at 150 yards. Your goal is to land the ball between the sticks. Track success rate over 20 shots.'),
  ('3-6-9 putting ladder', 'Progressive putting drill from 3, 6, and 9 feet', 15, 'putting', '{putting}', '{beginner,casual,developing,competitive}', 'Place 3 balls at 3ft, 3 balls at 6ft, 3 balls at 9ft. Must make all 3 at each distance to advance. Restart from 3ft if you miss.'),
  ...
```

---

## Acceptance criteria

Phase 1 is complete when:
- [ ] `pnpm install` runs without errors from the root
- [ ] `pnpm dev` starts both web and mobile apps
- [ ] `pnpm typecheck` passes with zero errors across all packages
- [ ] Supabase local stack starts with `npx supabase start`
- [ ] All migrations apply cleanly
- [ ] Generated types exist at `packages/supabase/src/types.ts`
- [ ] A user can sign up and sign in on the web app
- [ ] After signup, a profile row is created automatically
- [ ] CI passes on GitHub
- [ ] Seed data loads (courses, holes, drills)

## Hand-off to Phase 2
Phase 2 picks up with the SG engine fully tested, shared types finalized, and the web app ready for feature development. The agent starting Phase 2 should read `CLAUDE.md` and `PHASE_2.md`.
