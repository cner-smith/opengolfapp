# Phase 3 — Web: round logging

## Goal
Build the full round logging experience on web. A user can create a round, select a course, enter hole-by-hole scores and shots, and have SG calculated automatically on save. This is the primary data entry path for users who log after a round.

## Key screens to build
- `NewRoundPage` — select course, date, tee color
- `RoundDetailPage` — hole-by-hole view with score, putts, GIR, fairway hit
- Shot entry modal per hole — club, lie type, slope grid, shot result, optional GPS coords
- Round summary — auto-calculated SG breakdown shown after saving

## Components to build

### `CourseSearch`
- Search box that queries `courses` table
- "Add course" flow if course doesn't exist (creates course + 18 holes with pars)
- Mapbox autocomplete for location

### `HoleScoreCard`
Grid of 18 holes. Each row:
- Hole number, par, yards
- Score input (number input or +/- buttons)
- Putts input
- Fairway toggle (Y/N, hidden on par 3s)
- GIR toggle
- "Add shots" button → opens ShotEntryModal

### `ShotEntryModal`
For detailed shot-by-shot logging within a hole. Shows hole map (Mapbox). User places shots on map. For each shot:
- Shot number (auto-incremented)
- Start position (tap on map or skip)
- Aim point (tap on map or skip)
- End position (tap on map or skip)
- Club selector (horizontal scroll)
- Lie type chips
- Slope grid (3×2)
- Shot result chips
- Optional: penalty, OB, note

### `RoundSummary`
After saving, show:
- Score to par
- SG breakdown (off tee / approach / around green / putting)
- Best and worst hole
- "Generate practice plan" CTA if 3+ rounds logged

## SG calculation on save
When a round is saved:
1. Fetch all shots for the round with distance context
2. Run `calculateRoundSG` from `@oga/core`
3. Update `rounds` table with `sg_off_tee`, `sg_approach`, `sg_around_green`, `sg_putting`, `sg_total`
4. Update each `hole_scores` row with per-hole SG

This can run client-side since the calculation is pure JS. No edge function needed for this.

## Acceptance criteria
- [ ] User can create a round, select/create a course, enter 18 hole scores
- [ ] Shots can be entered per hole with full metadata
- [ ] SG is calculated and saved on round completion
- [ ] Round appears in rounds list with score and SG total
- [ ] Round detail page shows hole-by-hole breakdown

## Hand-off to Phase 4
Phase 4 builds the analytics/SG dashboard. Agent reads `CLAUDE.md` + `PHASE_4.md`.

---

# Phase 4 — Web: analytics dashboard

## Goal
Build the full analytics experience — SG dashboard, trends over time, shot pattern visualization, and per-club dispersion charts.

## Key screens

### Dashboard / Overview (`/dashboard`)
- Handicap trend chart (last 20 rounds)
- Metric cards: avg score, SG total, GIR, putts/hole
- SG breakdown bar chart (4 categories)
- AI insight card: plain-English summary of biggest opportunity
- Today's focus: top 2 weaknesses
- Recent rounds list

### Strokes gained page (`/stats`)
- SG by category (last N rounds selector: 5 / 10 / 20)
- Approach breakdown by distance band (50–100, 100–150, 150–200, 200+)
- Putting breakdown by distance band (0–5ft, 5–10ft, 10–20ft, 20–40ft, 40+ft)
- Trend chart: SG per category over time
- "Build practice plan" CTA from any weakness

### Shot patterns page (`/patterns`)
- Club selector tabs
- Dispersion scatter plot (SVG or Canvas) with 68%/95% ellipses
- Aim point as reference center
- Points colored by result (solid = green, push/pull = amber, big miss = red)
- Pattern summary: avg lateral offset, avg distance bias, shot shape, aim correction tip
- Lie filter: all lies / level only / ball above / ball below / uphill / downhill

## Charts
Use **Recharts** for line/bar charts (`pnpm install recharts`).
Use **D3** or plain SVG for dispersion scatter — more control over the ellipse rendering.

## Acceptance criteria
- [ ] Dashboard shows correct SG data from logged rounds
- [ ] Trend charts update as new rounds are added
- [ ] Shot pattern ellipses render correctly for clubs with 5+ shots
- [ ] Lie filter changes the dispersion correctly
- [ ] Aim correction tip matches the actual miss direction

## Hand-off to Phase 5
Phase 5 builds AI practice plan generation. Agent reads `CLAUDE.md` + `PHASE_5.md`.

---

# Phase 5 — Web: practice plans + AI

## Goal
Build the AI-powered practice plan generator. A user can request a plan, the app calls a Supabase Edge Function that queries Claude, and the result is stored and displayed as an actionable drill checklist.

## Supabase Edge Function: `generate-practice-plan`

Create `supabase/functions/generate-practice-plan/index.ts`:

```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'

serve(async (req) => {
  const { userId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch profile and recent SG data
  const [{ data: profile }, { data: rounds }, { data: drills }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('rounds')
      .select('sg_off_tee, sg_approach, sg_around_green, sg_putting, sg_total, played_at')
      .eq('user_id', userId)
      .not('sg_total', 'is', null)
      .order('played_at', { ascending: false })
      .limit(10),
    supabase.from('drills')
      .select('id, name, description, duration_min, category, facility, skill_levels')
      .contains('skill_levels', [profile.skill_level])
  ])

  if (!profile || !rounds?.length) {
    return new Response(JSON.stringify({ error: 'Insufficient data' }), { status: 400 })
  }

  // Calculate average SG per category
  const avgSG = {
    offTee: avg(rounds.map(r => r.sg_off_tee ?? 0)),
    approach: avg(rounds.map(r => r.sg_approach ?? 0)),
    aroundGreen: avg(rounds.map(r => r.sg_around_green ?? 0)),
    putting: avg(rounds.map(r => r.sg_putting ?? 0)),
  }

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

  const prompt = `
You are a golf performance coach. Generate a personalized practice plan in JSON only.

Player profile:
- Skill level: ${profile.skill_level}
- Handicap: ${profile.handicap_index}
- Goal: ${profile.goal}
- Facilities available: ${profile.facilities?.join(', ')}
- Play frequency: ${profile.play_frequency}

Strokes gained (avg last ${rounds.length} rounds, positive = better than bracket average):
- Off the tee: ${avgSG.offTee.toFixed(2)}
- Approach: ${avgSG.approach.toFixed(2)}
- Around green: ${avgSG.aroundGreen.toFixed(2)}
- Putting: ${avgSG.putting.toFixed(2)}

Available drills:
${JSON.stringify(drills, null, 2)}

Return ONLY valid JSON in this exact format:
{
  "focus_areas": [
    { "category": "approach", "priority": 1, "sg_value": -1.4, "insight": "..." }
  ],
  "selected_drill_ids": ["drill-id-1", "drill-id-2", "drill-id-3", "drill-id-4", "drill-id-5"],
  "ai_insight": "Plain English 2-3 sentence summary of the player's game and what to focus on"
}

Rules:
- Select 4-6 drills total
- Weight selection toward the lowest SG categories
- For strong categories (positive SG), include 1 maintenance drill
- Only select drills available at their listed facilities
- Return ONLY the JSON object, no other text
`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  })

  const planData = JSON.parse(response.content[0].text)

  // Fetch full drill details for selected IDs
  const { data: selectedDrills } = await supabase
    .from('drills')
    .select('*')
    .in('id', planData.selected_drill_ids)

  const plan = {
    user_id: userId,
    based_on_rounds: rounds.length,
    focus_areas: planData.focus_areas,
    drills: selectedDrills,
    ai_insight: planData.ai_insight,
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  }

  const { data: savedPlan } = await supabase
    .from('practice_plans')
    .insert(plan)
    .select()
    .single()

  return new Response(JSON.stringify(savedPlan), {
    headers: { 'Content-Type': 'application/json' }
  })
})

function avg(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
```

## Web UI

### `PracticePlanPage`
- Shows current plan if one exists within the last 7 days
- "Generate new plan" button → calls Edge Function → shows loading state
- Plan renders as:
  - AI insight card at top
  - Sections by category (priority order)
  - Each drill as a checklist item with name, duration, facility, description
  - Check off drills → updates `completed_drill_ids` in Supabase

### `DrillLibraryPage`
- Filterable list of all drills
- Filters: category, facility, skill level
- Each drill card shows full instructions
- "Add to plan" button for manual customization (stretch goal)

## Acceptance criteria
- [ ] Edge Function deploys and runs locally
- [ ] Plan generation returns valid JSON and saves to DB
- [ ] Plan renders with correct drills for the user's skill level
- [ ] Checking off a drill persists across page reloads
- [ ] "Generate new plan" is disabled if fewer than 3 rounds logged

## Hand-off to Phase 6
Phase 6 builds the mobile live round tracker. Agent reads `CLAUDE.md` + `PHASE_6.md`.

---

# Phase 6 — Mobile: live round tracker

## Goal
Build the on-course live round tracking experience in the Expo app. This is the core mobile use case — fast, GPS-assisted, minimal friction shot logging while actively playing.

## Critical UX constraints (do not violate)
- Max 3 taps to log a shot location
- Metadata (club, lie, slope, result) is always skippable
- "Skip all — just track location" button always visible
- Never block the user before they hit the shot
- GPS location captured automatically as backup to manual pin placement

## Screen flow
```
New round → select course → hole 1 map
  → tap to set aim point (before shot)
  → [user hits shot]
  → drag ball to landing position
  → fill metadata while walking (or skip)
  → confirm → hole map advances to next shot
  → finish hole → scorecard summary
  → next hole...
→ round complete → SG calculation → summary
```

## Key components

### `HoleMap` (mobile)
Mapbox map centered on current hole. Shows:
- Tee box marker
- Pin marker
- Previous shot markers with trajectory lines
- Current ball position (draggable)
- Aim point marker (orange, set via long-press or dedicated mode)
- Distance to pin overlay

### `ShotLogger`
Bottom sheet (slides up) after ball position is set. Contains:
- Club selector (horizontal scroll chips)
- Lie type chips (4 options)
- Slope grid (3×2 SVG grid — matches the design from our mockups)
- Shot result chips
- Penalty / OB toggles
- "Save + next shot →" button
- "Skip all" text button

### `LiveRoundContext`
React context that holds the in-progress round state:
- Current hole number
- Shots logged so far
- Current hole score
- GPS subscription

### GPS integration
```ts
import * as Location from 'expo-location'

// Request permissions on round start
await Location.requestForegroundPermissionsAsync()

// Get current position for auto-placing ball marker
const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.High
})
// Use as default ball position, user can adjust by dragging
```

### Offline support
Shots should save locally first (AsyncStorage or SQLite via expo-sqlite), then sync to Supabase when connectivity is restored. A round in progress should never lose data due to poor signal on course.

```ts
// Save to local SQLite immediately
await db.runAsync('INSERT INTO pending_shots VALUES (?)', [JSON.stringify(shot)])
// Attempt Supabase sync in background
syncPendingShots()
```

## Scorecard
Live scorecard visible from the round screen. Shows:
- Holes 1-18 in a scrollable list
- Score per hole (eagle/birdie/par/bogey/double styling from mockups)
- Running score to par
- Completed vs in-progress indicator

## Acceptance criteria
- [ ] User can start a live round, select a course, and navigate holes
- [ ] Tap-to-set aim point works on the Mapbox map
- [ ] Drag ball marker to landing position works
- [ ] Metadata sheet slides up after ball placement
- [ ] Skip all works — only location is saved
- [ ] GPS auto-places ball marker within ~5 meters
- [ ] Shots save to local SQLite immediately
- [ ] Shots sync to Supabase when online
- [ ] Scorecard updates in real time as holes are completed

## Hand-off to Phase 7
Phase 7 brings full feature parity to mobile. Agent reads `CLAUDE.md` + `PHASE_7.md`.

---

# Phase 7 — Mobile: full feature parity

## Goal
Port all web analytics features to the mobile app so users have the full OGA experience on phone.

## Screens to build (mobile equivalents of web)
- Dashboard / home tab — handicap trend, SG breakdown, today's focus
- Stats tab — SG by category, approach/putting breakdowns
- Shot patterns tab — per-club dispersion with lie filtering
- Practice tab — current plan as drill checklist
- Profile tab — settings, handicap, goal, facilities

## Notes
- Charts: use **Victory Native** (`pnpm install victory-native`) — React Native compatible charting
- Dispersion plot: build as SVG using React Native SVG (`pnpm install react-native-svg`)
- Most logic reuses hooks from `@oga/supabase` — minimal new code needed
- Navigation: Expo Router tab navigator already set up in Phase 6

## Acceptance criteria
- [ ] All 5 tabs work with real data
- [ ] Dispersion plot renders correctly on mobile
- [ ] Practice plan checklist works identically to web
- [ ] Profile edit updates handicap and recalibrates SG benchmarks

## Hand-off to Phase 8
Phase 8 is open source launch prep. Agent reads `CLAUDE.md` + `PHASE_8.md`.

---

# Phase 8 — Open source launch prep

## Goal
Get the repo ready for public open source release. Clean documentation, contribution guide, good README, working demo, and a simple way for people to self-host.

## Deliverables

### `README.md` (root)
- Project description and screenshots
- Feature list
- Tech stack
- Quick start (web dev setup in under 5 commands)
- Self-hosting guide (Supabase + Vercel)
- Contributing guide link
- License (MIT)
- Link to live demo

### `CONTRIBUTING.md`
- How to report bugs
- How to suggest features
- Development setup
- Pull request process
- Code style guide (Prettier + ESLint config)
- How to add drills to the library (this is a big contribution area)

### Self-hosting guide (`docs/self-hosting.md`)
- Fork the repo
- Create Supabase project and run migrations
- Deploy web app to Vercel (one click deploy button)
- Set environment variables
- Optional: deploy mobile app to Expo

### Demo data
- Create a script `scripts/seed-demo.ts` that creates a demo user with:
  - 15 rounds of realistic data
  - Varied SG across categories
  - Shot-level data for pattern visualization
  - A generated practice plan

### ESLint + Prettier config
```bash
pnpm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier
```

Add `.eslintrc.json` and `.prettierrc` at root.

### `vercel.json` for one-click deploy
```json
{
  "buildCommand": "cd apps/web && pnpm build",
  "outputDirectory": "apps/web/dist",
  "installCommand": "pnpm install"
}
```

## Acceptance criteria
- [ ] README has clear setup instructions that work end-to-end
- [ ] Demo data script runs and creates believable data
- [ ] New contributor can get dev environment running from README alone
- [ ] Vercel deploy button works
- [ ] MIT license file present
- [ ] ESLint and Prettier pass on all files
