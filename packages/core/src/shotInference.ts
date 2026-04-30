// Pure inference for post-round map-tap shot entry. No DB or Mapbox
// imports — runs the same on web and mobile. Given a placed shot's
// coordinates plus tee/pin context, returns suggested club, lie type,
// distances, and a confidence rating.

import type { Club, LieType } from './constants'

export interface PlacedShot {
  shotNumber: number
  lat: number
  lng: number
  /** Position the shot was hit FROM. Caller usually passes the previous
   *  shot's (lat, lng); for shot 1 leave undefined and the inferrer uses
   *  teeLat/teeLng. */
  prevLat?: number
  prevLng?: number
  pinLat: number
  pinLng: number
  teeLat: number
  teeLng: number
  /** Total shots placed for this hole. Used to identify the last shot. */
  totalShotsOnHole: number
  par: number
}

export interface InferredShot {
  suggestedClub: Club
  suggestedLieType: LieType
  /** Distance the shot itself travelled (start → end) in yards. */
  distanceYards: number
  /** Distance from the shot's end to the pin. */
  distanceToPin: number
  isLastShot: boolean
  confidence: 'high' | 'medium' | 'low'
}

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

export function haversineYards(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const meters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return meters * 1.09361
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

// ---------------------------------------------------------------------------
// Lie inference
// ---------------------------------------------------------------------------

const NEAR_GREEN_YARDS = 30
const ON_GREEN_YARDS = 5

function inferLie(args: {
  isFirstShot: boolean
  isLastShot: boolean
  startToPinYards: number
  endToPinYards: number
}): LieType {
  // Tee shots are always 'tee'.
  if (args.isFirstShot) return 'tee'
  // Final shot that holed out: it was a putt (or a chip-in we'll treat
  // as a putt for default; user can edit).
  if (args.isLastShot && args.endToPinYards <= ON_GREEN_YARDS) return 'green'
  // Already on the green when this shot was hit (a lag, a 3rd putt, etc).
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
  isLastShot: boolean
  endToPinYards: number
  distanceYards: number
  startToPinYards: number
}): InferredShot['confidence'] {
  // Tee shot is the highest-confidence lie call we make.
  if (args.isFirstShot) return 'high'
  // Tap-in / putt: high.
  if (args.isLastShot && args.endToPinYards <= ON_GREEN_YARDS) return 'high'
  // From green to green-ish: high.
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

  const startLat = shot.prevLat ?? (isFirstShot ? shot.teeLat : shot.lat)
  const startLng = shot.prevLng ?? (isFirstShot ? shot.teeLng : shot.lng)

  const distanceYards = round1(
    haversineYards(startLat, startLng, shot.lat, shot.lng),
  )
  const distanceToPin = round1(
    haversineYards(shot.lat, shot.lng, shot.pinLat, shot.pinLng),
  )
  const startToPinYards = haversineYards(
    startLat,
    startLng,
    shot.pinLat,
    shot.pinLng,
  )

  const lie = inferLie({
    isFirstShot,
    isLastShot,
    startToPinYards,
    endToPinYards: distanceToPin,
  })

  let club: Club
  if (lie === 'green') {
    club = 'putter'
  } else if (isFirstShot) {
    club = clubForTeeShot(distanceYards, shot.par)
  } else {
    club = clubForFullShotYards(distanceYards)
  }

  const confidence = confidenceFor({
    isFirstShot,
    isLastShot,
    endToPinYards: distanceToPin,
    distanceYards,
    startToPinYards,
  })

  return {
    suggestedClub: club,
    suggestedLieType: lie,
    distanceYards,
    distanceToPin,
    isLastShot,
    confidence,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
