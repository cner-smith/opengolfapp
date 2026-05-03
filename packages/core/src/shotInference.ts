// Pure inference for post-round map-tap shot entry. No DB or Mapbox
// imports — runs the same on web and mobile. Given a placed shot's
// coordinates plus tee/pin context, returns suggested club, lie type,
// distances, and a confidence rating.

import { CLUBS, NEAR_GREEN_YARDS, type Club, type LieType } from './constants'
import { haversineYards } from './units'

/** A user-bag entry the inference layer can match against. Values mirror
 *  the `user_clubs` row but the inference engine never imports
 *  @oga/supabase, so we accept the minimal shape. `typical_distance_yards`
 *  is the user's measured carry; when present we prefer it over the
 *  static lookup table. */
export interface UserBagClub {
  club_type: string
  typical_distance_yards?: number | null
}

export interface PlacedShot {
  shotNumber: number
  /** Where the shot was hit FROM — the player's stance for this shot.
   *  Marker N's coordinates in the post-round tap-to-place flow. */
  startLat: number
  startLng: number
  /** Where the shot ended. For non-last shots = next marker (the start
   *  of the following shot). For the final shot of a hole that was
   *  holed out = the pin. */
  endLat: number
  endLng: number
  pinLat: number
  pinLng: number
  /** Total shots placed for this hole. Used to identify the last shot. */
  totalShotsOnHole: number
  par: number
  /** Optional user bag. When supplied, club suggestion restricts to
   *  clubs the user actually carries; if rows include
   *  `typical_distance_yards`, the suggester picks the nearest match
   *  by user-measured carry instead of the static table. */
  userBag?: readonly UserBagClub[]
}

export interface InferredShot {
  /** Canonical Club when no user bag was supplied or the suggestion
   *  matched the static table; arbitrary string when the suggestion
   *  came from a user-bag entry whose club_type isn't in CLUBS (a
   *  utility / chipper / mini-driver). The DB column is text so
   *  downstream callers don't need to narrow. */
  suggestedClub: Club | string
  suggestedLieType: LieType
  /** Distance the shot itself travelled (start → end) in yards. */
  distanceYards: number
  /** Distance from the shot's START to the pin — the yards remaining
   *  when the player stood over the ball. Matches the schema's
   *  `shots.distance_to_target` semantic. */
  distanceToPin: number
  isLastShot: boolean
  confidence: 'high' | 'medium' | 'low'
}

// ---------------------------------------------------------------------------
// Club selection
// ---------------------------------------------------------------------------

// General amateur club distances, indexed by full-shot yardage. Used for
// non-tee shots and par-3 tee shots.
function clubForFullShotYards(yards: number): Club {
  if (yards >= 220) return 'driver'
  if (yards >= 195) return '3w'
  if (yards >= 175) return '5w'
  if (yards >= 165) return '4i'
  if (yards >= 155) return '5i'
  if (yards >= 145) return '6i'
  if (yards >= 135) return '7i'
  if (yards >= 120) return '8i'
  if (yards >= 105) return '9i'
  if (yards >= 90) return 'pw'
  if (yards >= 75) return 'gw'
  if (yards >= 55) return 'sw'
  return 'lw'
}

// Tee-shot specific buckets for par-4 / par-5 holes per the spec — pros
// and stronger amateurs reach for driver above ~200, 3w in the 180–200
// window, hybrid in the 150–180 window. Below that, fall back to the
// general iron table.
function clubForTeeShot(distanceYards: number, par: number): Club {
  if (par === 3) return clubForFullShotYards(distanceYards)
  if (distanceYards >= 200) return 'driver'
  if (distanceYards >= 180) return '3w'
  if (distanceYards >= 150) return '3h'
  return clubForFullShotYards(distanceYards)
}

// Pick the user's club whose typical_distance_yards is closest to the
// shot distance. Only considers rows where the user has actually
// recorded a typical distance. Returns null when the bag has no usable
// distances so callers can fall back.
function clubFromUserDistances(
  distanceYards: number,
  bag: readonly UserBagClub[],
): string | null {
  let best: { club_type: string; diff: number } | null = null
  for (const club of bag) {
    const dist = club.typical_distance_yards
    if (dist == null) continue
    const diff = Math.abs(dist - distanceYards)
    if (best === null || diff < best.diff) {
      best = { club_type: club.club_type, diff }
    }
  }
  return best?.club_type ?? null
}

// Picked club may not be in the user's bag — swap to the nearest one
// that is. Search outward through the canonical CLUBS ladder, preferring
// one step LONGER over shorter so approaches don't systematically come
// up short. Returns null if no canonical club_type from CLUBS appears
// in the bag (caller falls back to the picked club).
const CLUB_LADDER: readonly Club[] = CLUBS.filter((c) => c !== 'putter')

function nearestBaggedClub(
  picked: Club,
  bag: readonly UserBagClub[],
): string | null {
  const owned = new Set(bag.map((c) => c.club_type))
  if (owned.has(picked)) return picked
  const idx = CLUB_LADDER.indexOf(picked)
  if (idx < 0) return null
  for (let step = 1; step < CLUB_LADDER.length; step++) {
    const longer = CLUB_LADDER[idx - step]
    if (longer && owned.has(longer)) return longer
    const shorter = CLUB_LADDER[idx + step]
    if (shorter && owned.has(shorter)) return shorter
  }
  return null
}

// ---------------------------------------------------------------------------
// Lie inference
// ---------------------------------------------------------------------------

// Threshold for "this shot started on (or so close to) the green that the
// next stroke is a putt." 15 yd captures fringe lag putts and short
// chip-ins that are functionally putts; tighter than 15 misclassifies
// most casual short approaches.
const ON_GREEN_YARDS = 15

function inferLie(args: {
  isFirstShot: boolean
  startToPinYards: number
}): LieType {
  // Tee shots are always 'tee'.
  if (args.isFirstShot) return 'tee'
  // Already on the green when this shot was hit (any putt — last or not).
  if (args.startToPinYards <= ON_GREEN_YARDS) return 'green'
  // Just off the green: fringe is the most useful default.
  if (args.startToPinYards <= NEAR_GREEN_YARDS) return 'fringe'
  // Per spec, default off-fairway when no polygon data is available.
  return 'rough'
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function confidenceFor(args: {
  isFirstShot: boolean
  startToPinYards: number
  distanceYards: number
}): InferredShot['confidence'] {
  // Tee shot is the highest-confidence lie call we make.
  if (args.isFirstShot) return 'high'
  // Started on the green: putt — high confidence.
  if (args.startToPinYards <= ON_GREEN_YARDS) return 'high'
  // Standard mid-iron approach: medium.
  if (args.distanceYards >= 100 && args.distanceYards <= 200) return 'medium'
  // Short partial wedges, very long pokes, awkward bunker-zone distances:
  // user should sanity-check.
  return 'low'
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function inferShot(shot: PlacedShot): InferredShot {
  const isFirstShot = shot.shotNumber === 1
  const isLastShot = shot.shotNumber === shot.totalShotsOnHole

  const distanceYards = round1(
    haversineYards(shot.startLat, shot.startLng, shot.endLat, shot.endLng),
  )
  const startToPinYards = haversineYards(
    shot.startLat,
    shot.startLng,
    shot.pinLat,
    shot.pinLng,
  )

  const lie = inferLie({ isFirstShot, startToPinYards })

  // Static table picks first, then we re-bias against the user's bag if
  // one was supplied. This keeps tee-vs-fairway logic, par-3 routing,
  // and putter-on-green selection in one place — the bag step only
  // tweaks WHICH club from the suggested ladder the player would
  // actually pull.
  let club: Club | string
  if (lie === 'green') {
    club = 'putter'
  } else if (isFirstShot) {
    club = clubForTeeShot(distanceYards, shot.par)
  } else {
    club = clubForFullShotYards(distanceYards)
  }

  if (lie !== 'green' && shot.userBag && shot.userBag.length > 0) {
    const fromDistances = clubFromUserDistances(distanceYards, shot.userBag)
    if (fromDistances != null) {
      club = fromDistances
    } else {
      // User bag exists but no typical_distance_yards anywhere — restrict
      // the table pick to clubs they actually carry.
      const swapped = nearestBaggedClub(club as Club, shot.userBag)
      if (swapped != null) club = swapped
    }
  }

  const confidence = confidenceFor({
    isFirstShot,
    startToPinYards,
    distanceYards,
  })

  return {
    suggestedClub: club,
    suggestedLieType: lie,
    distanceYards,
    distanceToPin: round1(startToPinYards),
    isLastShot,
    confidence,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
