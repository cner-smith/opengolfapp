// IMPORT-FREE so the round-summary Edge Function can vendor it verbatim
// (`pnpm email:vendor-core`).

export interface HoleBase {
  par: number
  yards: number | null
  stroke_index: number | null
  tee_lat: number | null
  tee_lng: number | null
}

export interface HoleTeeOverride {
  yards: number | null
  par: number | null
  stroke_index: number | null
  tee_lat: number | null
  tee_lng: number | null
}

export interface HoleRoundOverride {
  par?: number | null
}

export interface HoleLiveOverride {
  tee_lat?: number | null
  tee_lng?: number | null
}

export interface ResolvedHole {
  par: number
  yards: number | null
  strokeIndex: number | null
  teeLat: number | null
  teeLng: number | null
}

// Precedence per field: live in-session drag > per-tee override (hole_tees)
// > base default (holes) for tee location; live in-session drag > per-round
// persisted override (hole_scores.par) > per-tee override > base for par.
// `hole_tees` is sparse by design — course_tees.par is ~0% populated in real
// data today (see round.ts), so when `teeOverride` is absent every field
// must fall straight through to `base`. Pin location is deliberately not
// resolved here — the green doesn't move per tee, only the tee box does;
// callers resolve pin separately exactly as they do today. There's no
// per-round persisted tee-location column (only live in-session drag), so
// HoleRoundOverride carries only `par`.
export function resolveHole(
  base: HoleBase,
  teeOverride: HoleTeeOverride | null | undefined,
  roundOverride?: HoleRoundOverride,
  liveOverride?: HoleLiveOverride,
): ResolvedHole {
  return {
    par: playedPar(base.par, teeOverride?.par, roundOverride?.par),
    yards: teeOverride?.yards ?? base.yards,
    strokeIndex: teeOverride?.stroke_index ?? base.stroke_index,
    teeLat: liveOverride?.tee_lat ?? teeOverride?.tee_lat ?? base.tee_lat,
    teeLng: liveOverride?.tee_lng ?? teeOverride?.tee_lng ?? base.tee_lng,
  }
}

function playedPar(holePar: number, teePar: number | null | undefined, roundPar: number | null | undefined): number {
  return roundPar ?? teePar ?? holePar
}

// The par each scored hole was played at, in hole_scores order, for a reader
// holding the round's hole_scores with their hole and every tee's hole_tees
// rows (the round-summary email, #1462). Same rule as resolveHole (owner rule
// Q4). A missing hole row reads as par 4.
export function scoredHolePars(
  holeScores: readonly {
    score: number | null
    /** hole_scores.par, the round's override. */
    par: number | null
    holes: { par: number; hole_tees: readonly { course_tee_id: string; par: number | null }[] } | null
  }[],
  teeId: string | null | undefined,
): number[] {
  return holeScores
    .filter((hs) => (hs.score ?? 0) > 0)
    .map((hs) => {
      const teeRow = teeId ? hs.holes?.hole_tees.find((ht) => ht.course_tee_id === teeId) : undefined
      return playedPar(hs.holes?.par ?? 4, teeRow?.par, hs.par)
    })
}

// Resolves which course_tees row a round is playing: prefer the id
// (course_tee_id), fall back to matching on tee_color. Both rounds.course_tee_id
// and rounds.tee_color are nullable, so this can legitimately return null
// (round has no tee selected, or the referenced tee was later deleted).
// Lifted out of three previously-duplicated inline copies of this exact
// fallback (useCompleteRound.ts, useRoundActions.ts, mobile completeRound.ts).
export function resolveCourseTee<T extends { id: string; tee_color: string }>(
  tees: readonly T[],
  courseTeeId: string | null | undefined,
  teeColor: string | null | undefined,
): T | null {
  if (courseTeeId) {
    const byId = tees.find((t) => t.id === courseTeeId)
    if (byId) return byId
  }
  if (teeColor) {
    // course_tees.tee_color is stored lowercase (TeeSelector.tsx lowercases
    // on write); the incoming round.tee_color isn't guaranteed to match
    // case, so normalize here — matches the lowercasing every existing
    // call site already applied before this helper existed.
    const normalized = teeColor.toLowerCase()
    const byColor = tees.find((t) => t.tee_color === normalized)
    if (byColor) return byColor
  }
  return null
}
