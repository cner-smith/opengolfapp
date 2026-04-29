# OGA — Open Golf App

## Project overview

OGA is a free, open source golf tracking and improvement platform. It does everything paid apps like Arccos, Shot Scope, and Break X Golf do — shot tracking, strokes gained analysis, personalized AI-driven practice plans, shot pattern dispersion — and charges nothing. Ever.

The core belief: getting better at golf shouldn't be paywalled.

## What we're building

### Core features (in priority order)
1. **Round logging** — hole-by-hole shot entry with club, lie type, lie angle/slope, and shot result
2. **Live round mode** — GPS-assisted shot tracking optimized for speed (mark ball + set aim point before shot, fill metadata while walking)
3. **Strokes gained engine** — SG calculation vs. handicap-bracket baselines (off tee, approach, around green, putting)
4. **Practice plan generator** — AI-driven plans via Claude API, calibrated to skill level and goal
5. **Shot pattern analysis** — per-club dispersion cones (68% / 95%), miss tendency, aim correction tips
6. **Green logging** — aim point vs. hole, break direction, result; crowdsourced green contour data over time
7. **Onboarding** — skill level, handicap, goal, facilities, play frequency → calibrates everything

### What makes OGA different
- **Lie slope data** — tracks ball-above/below feet and uphill/downhill stance per shot. Almost no apps do this. Enables filtering shot patterns by lie type.
- **Explicit aim point capture** — user sets aim point before hitting, not inferred. Required for meaningful dispersion data.
- **Skill-calibrated plans** — a beginner breaking 100 gets fundamentally different drills than a scratch player. Plans adapt as handicap changes.
- **Fully free** — no paywalls, no ads. Sustained by donations and open source community.

---

## Tech stack

### Monorepo
- **Turborepo** + **pnpm workspaces**
- All packages in TypeScript strict mode

### Apps
| App | Tech | Purpose |
|-----|------|---------|
| `apps/web` | Vite + React 18 + TypeScript | Web dashboard — stats, SG, patterns, practice plans |
| `apps/mobile` | Expo + React Native + TypeScript | Mobile — live round tracking, on-course use |

### Packages
| Package | Purpose |
|---------|---------|
| `packages/core` | Shared business logic — SG calculations, types, validation |
| `packages/ui` | Shared React components (web + RN where possible) |
| `packages/supabase` | Generated Supabase types + client helpers |

### Backend
- **Supabase** — Postgres database, auth (email + OAuth), Row Level Security, Edge Functions
- No custom backend server. All server-side logic lives in Supabase Edge Functions (Deno).

### AI
- **Claude API** (`claude-sonnet-4-5` model) — called from a Supabase Edge Function, never from the client
- Used for: practice plan generation, AI insights on SG data

### Maps
- **Mapbox GL JS** (web) / **@rnmapbox/maps** (mobile) — hole maps, shot placement, green overlay
- Free tier: 50,000 map loads/month

### Styling
- Web: **Tailwind CSS** + **shadcn/ui**
- Mobile: **NativeWind** (Tailwind for React Native)

---

## Database schema (Supabase / Postgres)

```sql
-- Users (extends Supabase auth.users)
profiles (
  id uuid references auth.users primary key,
  username text unique,
  handicap_index numeric(4,1),
  skill_level text, -- 'beginner' | 'casual' | 'developing' | 'competitive'
  goal text,        -- 'break_100' | 'break_90' | 'break_80' | 'break_70s' | 'scratch'
  play_frequency text,
  facilities text[], -- ['range','short_game','putting','sim']
  play_style text,   -- 'casual' | 'mixed' | 'competitive'
  created_at timestamptz default now()
)

-- Courses
courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  mapbox_id text, -- Mapbox place ID for map centering
  created_by uuid references profiles,
  created_at timestamptz default now()
)

-- Holes
holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses not null,
  number int not null,
  par int not null,
  yards int,
  stroke_index int, -- handicap stroke index
  tee_lat numeric, tee_lng numeric,
  pin_lat numeric, pin_lng numeric,
  unique(course_id, number)
)

-- Rounds
rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  course_id uuid references courses not null,
  played_at date not null,
  tee_color text,
  total_score int,
  total_putts int,
  fairways_hit int, fairways_total int,
  gir int,
  sg_off_tee numeric(5,2),
  sg_approach numeric(5,2),
  sg_around_green numeric(5,2),
  sg_putting numeric(5,2),
  sg_total numeric(5,2),
  notes text,
  created_at timestamptz default now()
)

-- Hole scores
hole_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds not null,
  hole_id uuid references holes not null,
  score int not null,
  putts int,
  fairway_hit boolean,
  gir boolean,
  sg_off_tee numeric(4,2),
  sg_approach numeric(4,2),
  sg_around_green numeric(4,2),
  sg_putting numeric(4,2),
  unique(round_id, hole_id)
)

-- Individual shots
shots (
  id uuid primary key default gen_random_uuid(),
  hole_score_id uuid references hole_scores not null,
  user_id uuid references profiles not null,
  shot_number int not null,
  -- Location
  start_lat numeric, start_lng numeric,
  end_lat numeric, end_lng numeric,
  aim_lat numeric, aim_lng numeric,  -- explicit aim point set before shot
  distance_to_target int,            -- yards to pin/target at time of shot
  -- Club & lie
  club text,  -- 'driver'|'3w'|'5w'|'3h'|'4i'...'9i'|'pw'|'gw'|'sw'|'lw'|'putter'
  lie_type text,  -- 'tee'|'fairway'|'rough'|'sand'|'fringe'|'recovery'
  lie_slope text, -- 'level'|'uphill'|'downhill'|'ball_above'|'ball_below'
  -- Result
  shot_result text, -- 'solid'|'push_right'|'pull_left'|'fat'|'thin'|'shank'|'topped'
  penalty boolean default false,
  ob boolean default false,
  -- On-green specific
  aim_offset_yards numeric(4,1), -- yards from hole to aim point
  break_direction text,          -- 'left'|'right'|'straight'
  putt_result text,              -- 'made'|'short'|'long'|'missed_left'|'missed_right'
  putt_distance_ft numeric(4,1),
  -- Metadata
  notes text,
  created_at timestamptz default now()
)

-- Practice plans
practice_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  generated_at timestamptz default now(),
  valid_until date,
  based_on_rounds int,  -- number of rounds used to generate
  focus_areas jsonb,    -- [{category, sg_value, priority}]
  drills jsonb,         -- [{drill_id, name, duration_min, facility, category, description}]
  ai_insight text,
  completed_drill_ids text[] default '{}'
)

-- Drill library (global, not per-user)
drills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_min int,
  category text, -- 'off_tee'|'approach'|'around_green'|'putting'
  facility text[], -- ['range','short_game','putting','anywhere']
  skill_levels text[], -- which brackets this drill suits
  instructions text,
  created_at timestamptz default now()
)
```

### Row Level Security
- All user data (rounds, shots, hole_scores, practice_plans) is RLS-protected: users can only read/write their own rows
- `courses`, `holes`, `drills` are publicly readable
- RLS policies must be created for every user-owned table

---

## Strokes gained calculation

SG is calculated by comparing the expected score from a position to the expected score after the shot, relative to a baseline for the player's handicap bracket.

### Baseline tables
Store in `packages/core/src/sg-baselines.ts` — expected strokes to hole from distance, by handicap bracket:

```
Brackets: scratch, 5, 10, 15, 20, 25, 30+
Zones: putting (ft), approach (yd), around_green (yd)
```

Public research from Mark Broadie's "Every Shot Counts" provides scratch baselines. Handicap brackets are interpolated from available tour/amateur data.

### Formula
```
SG_shot = baseline_strokes_from_start - baseline_strokes_from_end - 1
```
Sum SG per category per hole, aggregate per round.

### Categories
- **Off tee**: tee shots on par 4s and 5s
- **Approach**: shots from >30 yd off the green, not from tee on par 4/5
- **Around green**: shots from ≤30 yd, not on the green
- **Putting**: all shots on the green

---

## AI practice plan generation

### Edge Function: `generate-practice-plan`
Called after user requests a new plan. Inputs:
- Last N rounds of SG data (default 10, min 3)
- User profile (skill level, goal, facilities, handicap)
- Available drill IDs from the drill library

Prompt structure:
```
System: You are a golf performance coach. Generate practice plans in JSON only.
User: [structured stats + profile + available drills]
```

Response schema:
```json
{
  "focus_areas": [{"category": "approach", "priority": 1, "sg_value": -1.4, "insight": "..."}],
  "drills": [{"drill_id": "...", "reason": "..."}],
  "ai_insight": "Plain English summary of the player's game and what will move the needle most"
}
```

Always returns valid JSON. Parse and store in `practice_plans` table.

---

## Key design decisions & conventions

### Speed-first mobile UX
The live round tracker must not slow down pace of play. Rules:
- Max 3 taps to log a shot (tap aim point on map, tap ball landing, tap club)
- Lie type and slope are one additional card — never blocking
- "Skip all — just track location" must always be visible
- Never require input before the shot is hit

### Shot logging flow (mobile, live round)
1. Arrive at ball → app shows hole map
2. Tap to set aim point (long press or dedicated tap mode)
3. Hit the shot
4. Drag ball marker to landing position
5. Fill metadata while walking (club, lie type, slope, result) — or skip
6. Tap "Save + next shot"

### Aim point is always explicit
Never infer aim = pin or aim = fairway center. That assumption is wrong for any competent golfer. The aim point tap is required for shot pattern data to be meaningful. On the green, aim point = start line, not the hole.

### Skill calibration
Practice plans, SG benchmarks, and drill difficulty all reference the user's `skill_level` + `handicap_index`. A handicap-14 player's SG is compared to a 14-handicap baseline, not scratch. Drills marked for `['beginner','casual']` never appear in a competitive player's plan.

### Naming conventions
- TypeScript: camelCase variables, PascalCase components/types, kebab-case files
- Database: snake_case everywhere
- CSS: Tailwind utility classes, no custom CSS except where Tailwind can't reach

### Environment variables
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  (Edge Functions only, never client)
ANTHROPIC_API_KEY           (Edge Functions only, never client)
MAPBOX_TOKEN
```

---

## Phases overview

| Phase | Focus | Deliverable |
|-------|-------|-------------|
| 1 | Repo + infra setup | Turborepo, Supabase schema, auth, CI |
| 2 | Core data layer | SG engine, types, shared package |
| 3 | Web — round logging | Manual round + shot entry on web |
| 4 | Web — analytics | SG dashboard, shot patterns, trends |
| 5 | Web — practice plans | AI plan generation + drill library |
| 6 | Mobile — live round | Expo app, GPS tracking, on-course UI |
| 7 | Mobile — full parity | All web features on mobile |
| 8 | Polish + open source | Docs, contribution guide, README |

Each phase has its own `PHASE_X.md` with full implementation details.

---

## Running the project

```bash
# Install dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Run web only
pnpm dev --filter=web

# Run mobile only
pnpm dev --filter=mobile

# Run type checks across all packages
pnpm typecheck

# Run tests
pnpm test
```

---

## Supabase local development

```bash
# Start local Supabase stack
npx supabase start

# Apply migrations
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript --local > packages/supabase/src/types.ts

# Deploy edge functions
npx supabase functions deploy generate-practice-plan
```
