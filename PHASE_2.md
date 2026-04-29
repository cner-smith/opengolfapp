# Phase 2 — Core data layer + SG engine

## Goal
Build out the `@oga/core` package fully — strokes gained calculator with tests, all shared types finalized, and utility functions used across the app. Also build the Supabase query layer (hooks + helpers) that both web and mobile apps will consume. At the end of this phase the SG engine is tested and correct, and both apps have a clean data access layer ready for feature work.

## Prerequisites
- Phase 1 complete — monorepo running, Supabase schema applied, types generated

---

## Step 1 — Complete the SG calculator

Extend `packages/core/src/sg-calculator.ts` with round-level aggregation:

```ts
import type { Shot, HoleScore, Round, SGBreakdown } from './types'
import { getShotCategory, getExpectedStrokes, calculateShotSG } from './sg-calculator'

export interface ShotWithContext extends Shot {
  par: number
  nextShotDistanceYards?: number
  nextShotDistanceFt?: number
  isLastShot: boolean
}

export function calculateRoundSG(
  shots: ShotWithContext[],
  handicap: number
): SGBreakdown {
  const breakdown: SGBreakdown = { offTee: 0, approach: 0, aroundGreen: 0, putting: 0, total: 0 }

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]
    const category = getShotCategory(shot, shot.par, shot.shotNumber)

    const startDistYards = shot.distanceToTarget
    const startDistFt = shot.lieType === 'green' && shot.puttDistanceFt ? shot.puttDistanceFt : undefined

    const startExpected = getExpectedStrokes(category, startDistYards, startDistFt, handicap)
    if (startExpected === null) continue

    let endExpected: number
    if (shot.isLastShot) {
      endExpected = 0
    } else {
      const nextShot = shots[i + 1]
      const nextCategory = getShotCategory(nextShot, nextShot.par, nextShot.shotNumber)
      const endExp = getExpectedStrokes(
        nextCategory,
        nextShot.distanceToTarget,
        nextShot.lieType === 'green' ? nextShot.puttDistanceFt : undefined,
        handicap
      )
      if (endExp === null) continue
      endExpected = endExp
    }

    const sg = calculateShotSG(startExpected, endExpected)

    switch (category) {
      case 'off_tee': breakdown.offTee += sg; break
      case 'approach': breakdown.approach += sg; break
      case 'around_green': breakdown.aroundGreen += sg; break
      case 'putting': breakdown.putting += sg; break
    }
  }

  breakdown.total = breakdown.offTee + breakdown.approach + breakdown.aroundGreen + breakdown.putting
  return breakdown
}

export function averageSGBreakdown(rounds: SGBreakdown[]): SGBreakdown {
  if (rounds.length === 0) return { offTee: 0, approach: 0, aroundGreen: 0, putting: 0, total: 0 }
  const sum = rounds.reduce((acc, r) => ({
    offTee: acc.offTee + r.offTee,
    approach: acc.approach + r.approach,
    aroundGreen: acc.aroundGreen + r.aroundGreen,
    putting: acc.putting + r.putting,
    total: acc.total + r.total,
  }), { offTee: 0, approach: 0, aroundGreen: 0, putting: 0, total: 0 })
  const n = rounds.length
  return {
    offTee: sum.offTee / n,
    approach: sum.approach / n,
    aroundGreen: sum.aroundGreen / n,
    putting: sum.putting / n,
    total: sum.total / n,
  }
}
```

---

## Step 2 — Shot pattern calculator

Create `packages/core/src/shot-patterns.ts`:

```ts
import type { Shot } from './types'

export interface DispersionPoint {
  lateralOffsetYards: number   // positive = right, negative = left
  distanceOffsetYards: number  // positive = long, negative = short
  shotResult?: string
  lieSlope?: string
  lieType?: string
}

export interface DispersionStats {
  avgLateralOffset: number     // avg miss direction
  avgDistanceOffset: number    // avg long/short bias
  stdLateral: number           // spread
  stdDistance: number
  cone68: { lateral: number; distance: number }   // 68% ellipse radii
  cone95: { lateral: number; distance: number }   // 95% ellipse radii
  dominantMiss: 'left' | 'right' | 'straight'
  shotShape: 'fade' | 'draw' | 'straight'
  sampleSize: number
}

export function computeDispersion(shots: Shot[]): DispersionPoint[] {
  return shots
    .filter(s => s.aimLat && s.aimLng && s.endLat && s.endLng)
    .map(s => {
      // Convert lat/lng offsets to approximate yards
      // 1 degree lat ≈ 111,000m ≈ 121,000 yards
      // 1 degree lng ≈ 111,000 * cos(lat) meters
      const latYards = 121000
      const lngYards = 121000 * Math.cos((s.aimLat! * Math.PI) / 180)

      const latDiff = (s.endLat! - s.aimLat!) * latYards
      const lngDiff = (s.endLng! - s.aimLng!) * lngYards

      return {
        lateralOffsetYards: lngDiff,
        distanceOffsetYards: latDiff,
        shotResult: s.shotResult ?? undefined,
        lieSlope: s.lieSlope ?? undefined,
        lieType: s.lieType ?? undefined,
      }
    })
}

export function computeDispersionStats(points: DispersionPoint[]): DispersionStats | null {
  if (points.length < 5) return null

  const laterals = points.map(p => p.lateralOffsetYards)
  const distances = points.map(p => p.distanceOffsetYards)

  const avgLat = laterals.reduce((a, b) => a + b, 0) / laterals.length
  const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length

  const stdLat = Math.sqrt(laterals.map(x => (x - avgLat) ** 2).reduce((a, b) => a + b, 0) / laterals.length)
  const stdDist = Math.sqrt(distances.map(x => (x - avgDist) ** 2).reduce((a, b) => a + b, 0) / distances.length)

  return {
    avgLateralOffset: avgLat,
    avgDistanceOffset: avgDist,
    stdLateral: stdLat,
    stdDistance: stdDist,
    cone68: { lateral: stdLat, distance: stdDist },
    cone95: { lateral: stdLat * 1.96, distance: stdDist * 1.96 },
    dominantMiss: Math.abs(avgLat) < 2 ? 'straight' : avgLat > 0 ? 'right' : 'left',
    shotShape: Math.abs(avgLat) < 3 ? 'straight' : avgLat > 0 ? 'fade' : 'draw',
    sampleSize: points.length,
  }
}

export function filterDispersionByLie(
  points: DispersionPoint[],
  lieSlope?: string,
  lieType?: string
): DispersionPoint[] {
  return points.filter(p => {
    if (lieSlope && p.lieSlope !== lieSlope) return false
    if (lieType && p.lieType !== lieType) return false
    return true
  })
}

export function getAimCorrection(stats: DispersionStats): string {
  const lateral = Math.round(Math.abs(stats.avgLateralOffset))
  const dir = stats.dominantMiss
  if (dir === 'straight' || lateral < 2) return 'Your pattern is well centered on target.'
  const oppDir = dir === 'right' ? 'left' : 'right'
  return `Aim ${lateral} yard${lateral !== 1 ? 's' : ''} ${oppDir} of your target to center your pattern.`
}
```

---

## Step 3 — Supabase query helpers

Create `packages/supabase/src/queries/` with one file per domain:

### `queries/rounds.ts`
```ts
import { supabase } from '../client'
import type { Database } from '../types'

type RoundInsert = Database['public']['Tables']['rounds']['Insert']
type RoundUpdate = Database['public']['Tables']['rounds']['Update']

export async function getRounds(userId: string, limit = 20) {
  return supabase
    .from('rounds')
    .select(`*, courses(name, location)`)
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit)
}

export async function getRound(roundId: string) {
  return supabase
    .from('rounds')
    .select(`*, courses(name, location), hole_scores(*, holes(*), shots(*))`)
    .eq('id', roundId)
    .single()
}

export async function createRound(round: RoundInsert) {
  return supabase.from('rounds').insert(round).select().single()
}

export async function updateRound(roundId: string, updates: RoundUpdate) {
  return supabase.from('rounds').update(updates).eq('id', roundId).select().single()
}

export async function deleteRound(roundId: string) {
  return supabase.from('rounds').delete().eq('id', roundId)
}

export async function getRecentSGData(userId: string, limit = 10) {
  return supabase
    .from('rounds')
    .select('played_at, sg_off_tee, sg_approach, sg_around_green, sg_putting, sg_total, total_score, courses(name)')
    .eq('user_id', userId)
    .not('sg_total', 'is', null)
    .order('played_at', { ascending: false })
    .limit(limit)
}
```

### `queries/shots.ts`
```ts
import { supabase } from '../client'
import type { Database } from '../types'

type ShotInsert = Database['public']['Tables']['shots']['Insert']

export async function getShotsForRound(roundId: string) {
  return supabase
    .from('shots')
    .select(`*, hole_scores!inner(round_id, holes(number, par))`)
    .eq('hole_scores.round_id', roundId)
    .order('shot_number')
}

export async function getShotsByClub(userId: string, club: string, limit = 200) {
  return supabase
    .from('shots')
    .select('*')
    .eq('user_id', userId)
    .eq('club', club)
    .not('aim_lat', 'is', null)
    .not('end_lat', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function createShot(shot: ShotInsert) {
  return supabase.from('shots').insert(shot).select().single()
}

export async function updateShot(shotId: string, updates: Partial<ShotInsert>) {
  return supabase.from('shots').update(updates).eq('id', shotId).select().single()
}
```

### `queries/profiles.ts`
```ts
import { supabase } from '../client'
import type { Database } from '../types'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export async function getProfile(userId: string) {
  return supabase.from('profiles').select('*').eq('id', userId).single()
}

export async function updateProfile(userId: string, updates: ProfileUpdate) {
  return supabase.from('profiles').update(updates).eq('id', userId).select().single()
}
```

### `queries/practice.ts`
```ts
import { supabase } from '../client'

export async function getDrills(skillLevel?: string, category?: string) {
  let query = supabase.from('drills').select('*')
  if (skillLevel) query = query.contains('skill_levels', [skillLevel])
  if (category) query = query.eq('category', category)
  return query.order('name')
}

export async function getLatestPracticePlan(userId: string) {
  return supabase
    .from('practice_plans')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()
}

export async function updatePlanProgress(planId: string, completedDrillIds: string[]) {
  return supabase
    .from('practice_plans')
    .update({ completed_drill_ids: completedDrillIds })
    .eq('id', planId)
}
```

Update `packages/supabase/src/index.ts`:
```ts
export { supabase } from './client'
export type { Database } from './types'
export * from './queries/rounds'
export * from './queries/shots'
export * from './queries/profiles'
export * from './queries/practice'
```

---

## Step 4 — React hooks for web app

Create `apps/web/src/hooks/` with data hooks. These wrap the Supabase queries with React Query for caching:

```bash
cd apps/web
pnpm install @tanstack/react-query
```

`apps/web/src/hooks/useRounds.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRounds, createRound, getRecentSGData } from '@oga/supabase'
import { useAuth } from './useAuth'

export function useRounds(limit = 20) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rounds', user?.id, limit],
    queryFn: () => getRounds(user!.id, limit).then(r => r.data),
    enabled: !!user,
  })
}

export function useRecentSG(limit = 10) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['sg', user?.id, limit],
    queryFn: () => getRecentSGData(user!.id, limit).then(r => r.data),
    enabled: !!user,
  })
}

export function useCreateRound() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createRound,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rounds', user?.id] }),
  })
}
```

`apps/web/src/hooks/useProfile.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfile, updateProfile } from '@oga/supabase'
import { useAuth } from './useAuth'

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id).then(r => r.data),
    enabled: !!user,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (updates: Parameters<typeof updateProfile>[1]) =>
      updateProfile(user!.id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
  })
}
```

`apps/web/src/hooks/useShotPatterns.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { getShotsByClub } from '@oga/supabase'
import { computeDispersion, computeDispersionStats, filterDispersionByLie } from '@oga/core'
import { useAuth } from './useAuth'

export function useShotPatterns(club: string, lieSlope?: string, lieType?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['patterns', user?.id, club, lieSlope, lieType],
    queryFn: async () => {
      const { data: shots } = await getShotsByClub(user!.id, club)
      if (!shots) return null
      let points = computeDispersion(shots as any)
      if (lieSlope || lieType) points = filterDispersionByLie(points, lieSlope, lieType)
      const stats = computeDispersionStats(points)
      return { points, stats }
    },
    enabled: !!user && !!club,
  })
}
```

---

## Step 5 — Tests for SG engine

Install Vitest in the core package:
```bash
cd packages/core
pnpm install -D vitest
```

`packages/core/src/sg-calculator.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getHandicapBracket, interpolateBaseline, PUTTING_BASELINES } from './sg-baselines'
import { getShotCategory, getExpectedStrokes, calculateShotSG } from './sg-calculator'

describe('getHandicapBracket', () => {
  it('returns 0 for scratch', () => expect(getHandicapBracket(0)).toBe(0))
  it('returns 5 for 5 handicap', () => expect(getHandicapBracket(5)).toBe(5))
  it('returns 10 for 10 handicap', () => expect(getHandicapBracket(10)).toBe(10))
  it('returns 15 for 14 handicap', () => expect(getHandicapBracket(14)).toBe(15))
  it('returns 30 for 35 handicap', () => expect(getHandicapBracket(35)).toBe(30))
})

describe('interpolateBaseline', () => {
  it('returns exact value when distance matches key', () => {
    expect(interpolateBaseline(PUTTING_BASELINES[0], 5)).toBe(1.14)
  })
  it('interpolates between keys', () => {
    const val = interpolateBaseline(PUTTING_BASELINES[0], 7)
    expect(val).toBeGreaterThan(1.14)
    expect(val).toBeLessThan(1.30)
  })
  it('clamps to min key', () => {
    expect(interpolateBaseline(PUTTING_BASELINES[0], 1)).toBe(1.03)
  })
  it('clamps to max key', () => {
    expect(interpolateBaseline(PUTTING_BASELINES[0], 100)).toBe(2.18)
  })
})

describe('calculateShotSG', () => {
  it('positive SG for better than expected shot', () => {
    // Expected 2.0 from start, expected 0.8 from end → gained 0.2
    expect(calculateShotSG(2.0, 0.8)).toBeCloseTo(0.2)
  })
  it('negative SG for worse than expected shot', () => {
    // Expected 1.4 from start, expected 1.5 from end → lost 0.1
    expect(calculateShotSG(1.4, 1.5)).toBeCloseTo(-1.1)
  })
  it('zero SG for exactly average shot', () => {
    // Expected 2.0 from start, expected 1.0 from end → exactly average
    expect(calculateShotSG(2.0, 1.0)).toBeCloseTo(0.0)
  })
})

describe('getShotCategory', () => {
  it('categorizes tee shot on par 4 as off_tee', () => {
    const shot = { lieType: 'tee', distanceToTarget: 400 } as any
    expect(getShotCategory(shot, 4, 1)).toBe('off_tee')
  })
  it('categorizes green shot as putting', () => {
    const shot = { lieType: 'green', distanceToTarget: 15 } as any
    expect(getShotCategory(shot, 4, 3)).toBe('putting')
  })
  it('categorizes close shot as around_green', () => {
    const shot = { lieType: 'fringe', distanceToTarget: 25 } as any
    expect(getShotCategory(shot, 4, 3)).toBe('around_green')
  })
})
```

`packages/core/package.json` — add test script:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## Step 6 — Export everything from core

Final `packages/core/src/index.ts`:
```ts
export * from './types'
export * from './constants'
export * from './sg-baselines'
export * from './sg-calculator'
export * from './shot-patterns'
```

---

## Acceptance criteria

Phase 2 is complete when:
- [ ] `pnpm test` passes all SG engine tests
- [ ] `pnpm typecheck` still passes with zero errors
- [ ] `computeDispersionStats` returns sensible values for mock shot data
- [ ] All Supabase query helpers are typed against the generated DB types
- [ ] React Query hooks work in the web app (can fetch profile, rounds)
- [ ] `getAimCorrection` returns correct directional advice for biased patterns

## Hand-off to Phase 3
Phase 3 builds the web round logging UI. Agent should read `CLAUDE.md` + `PHASE_3.md`.
