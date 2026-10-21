/**
 * The promo golfer's game (scripts/seed-promo.ts picks the rounds): a seeded
 * ~12-handicap who plays a hole shot by shot, from the tee to holing out.
 */
import { NEAR_GREEN_YARDS, type ShotContact, type ShotShape, type ShotStartLine } from '@oga/core'

// --- Deterministic dice -----------------------------------------------------

export interface Dice {
  between(lo: number, hi: number): number
  normal(sd: number): number
  chance(p: number): boolean
}

export function dice(seed: number): Dice {
  let a = seed >>> 0
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    between: (lo, hi) => lo + u() * (hi - lo),
    normal: (sd) => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()) * sd,
    chance: (p) => u() < p,
  }
}

// --- The player -------------------------------------------------------------

// Per club, in yards at the finish: `stock` is the number Sam plays it for (and
// typed in My Bag); a full swing finishes stock + `long` ± sdLong. The ball
// starts `start` ± sdStart off the aim line and curves `curve` ± sdCurve more
// (right = +); `mishit` is the rare thin / fat strike, which loses 20–45%.
// A right-handed fader; the 7-iron is the one club with a real pattern: a few
// yards short and right of the aim, starting on line and fading.
interface Play {
  stock: number
  long: number
  sdLong: number
  start: number
  sdStart: number
  curve: number
  sdCurve: number
  mishit: number
}
// prettier-ignore
export const PLAY: Record<string, Play> = {
  driver: { stock: 225, long: -2, sdLong: 9.5, start: -4, sdStart: 13, curve: 5, sdCurve: 17, mishit: 0.02 },
  '3w': { stock: 212, long: -3, sdLong: 9.5, start: -2, sdStart: 12, curve: 4, sdCurve: 16, mishit: 0.02 },
  '5w': { stock: 200, long: -3, sdLong: 9.5, start: -2, sdStart: 12, curve: 3, sdCurve: 15, mishit: 0.02 },
  '5h': { stock: 190, long: -3, sdLong: 9, start: -2, sdStart: 11, curve: 2.5, sdCurve: 14, mishit: 0.02 },
  '5i': { stock: 180, long: -3, sdLong: 8.5, start: -1, sdStart: 11, curve: 2.5, sdCurve: 14, mishit: 0.02 },
  '6i': { stock: 171, long: -3, sdLong: 8, start: -0.5, sdStart: 10, curve: 2, sdCurve: 13, mishit: 0.02 },
  '7i': { stock: 165, long: -5, sdLong: 7.5, start: 0.5, sdStart: 5, curve: 6, sdCurve: 3, mishit: 0.02 },
  '8i': { stock: 152, long: -2, sdLong: 7, start: 0, sdStart: 8, curve: 1, sdCurve: 12, mishit: 0.02 },
  '9i': { stock: 141, long: -2, sdLong: 6.5, start: 0, sdStart: 7.5, curve: 0.5, sdCurve: 11, mishit: 0.02 },
  pw: { stock: 130, long: -2, sdLong: 6, start: 0, sdStart: 6, curve: 0, sdCurve: 9, mishit: 0.02 },
  gw: { stock: 117, long: -2, sdLong: 5.5, start: 0, sdStart: 5.5, curve: 0, sdCurve: 8, mishit: 0.02 },
  sw: { stock: 103, long: -2, sdLong: 5, start: 0, sdStart: 5, curve: 0, sdCurve: 7, mishit: 0.02 },
  lw: { stock: 89, long: -2, sdLong: 4.5, start: 0, sdStart: 4.5, curve: 0, sdCurve: 6, mishit: 0.02 },
}
// Clubs played into a green or laid up with (not the driver), longest first.
const FAIRWAY_CLUBS = Object.keys(PLAY).filter((c) => c !== 'driver')
// Inside this, a pitch or chip: played by feel, logged without a club (the
// club's typical distance is its full swing, not a 30-yd pitch).
const PITCH_YARDS = 60
// How far off Sam's read of an approach's yardage is (wind, lie, the number):
// the miss comes from the club he picks, not from the club's own spread.
const JUDGE_SD = 10
// The share of a between-clubs yardage he takes off (or adds) by feel.
const FEEL = 0.15
const MAX_GO_FOR_IT = 224

function nearestClub(yards: number): string {
  return FAIRWAY_CLUBS.reduce((best, c) =>
    Math.abs(PLAY[c]!.stock - yards) < Math.abs(PLAY[best]!.stock - yards) ? c : best,
  )
}

// 1 / (1 + (ft / 7.5)^2.3): ~90% at 3 ft, half at 7.5 ft, ~12% at 20 ft.
function makeChance(ft: number): number {
  return ft < 1.5 ? 0.99 : 1 / (1 + (ft / 7.4) ** 2.3)
}

// --- Playing a hole (local frame: yards east / north of the tee) -------------

export interface Pt {
  x: number
  y: number
}
export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)
function toward(from: Pt, to: Pt, yards: number): Pt {
  const d = dist(from, to) || 1
  return { x: from.x + ((to.x - from.x) / d) * yards, y: from.y + ((to.y - from.y) / d) * yards }
}
// `along` past `aim` on the from→aim line and `right` to its right.
function offset(from: Pt, aim: Pt, along: number, right: number): Pt {
  const d = dist(from, aim) || 1
  const ux = (aim.x - from.x) / d
  const uy = (aim.y - from.y) / d
  return { x: aim.x + ux * along + uy * right, y: aim.y + uy * along - ux * right }
}

export interface SimShot {
  start: Pt
  aim: Pt
  end: Pt
  club: string | null
  lie: string
  contact: ShotContact | null
  startLine: ShotStartLine | null
  shape: ShotShape | null
  penalty: boolean
  ob: boolean
  putt?: { made: boolean; distance: 'short' | 'long' | null; direction: 'left' | 'right' | null }
}

export interface PromoHole {
  id: string
  number: number
  par: number
  tee: { lat: number; lng: number }
  pin: { lat: number; lng: number }
}

export function playHole(hole: PromoHole, d: Dice): SimShot[] {
  const kx = 121_000 * Math.cos((hole.tee.lat * Math.PI) / 180)
  const pin: Pt = {
    x: (hole.pin.lng - hole.tee.lng) * kx,
    y: (hole.pin.lat - hole.tee.lat) * 121_000,
  }
  const tee: Pt = { x: 0, y: 0 }
  const greenRadius = d.between(9, 13)
  const shots: SimShot[] = []
  let pos = tee
  let lie = 'tee'

  // Where a ball finishing at `end` lies; `offLine` = yards off the shot's line.
  const lieAt = (end: Pt, offLine: number): string => {
    const r = dist(end, pin)
    if (r <= greenRadius) return 'green'
    if (r <= NEAR_GREEN_YARDS)
      return r <= greenRadius + 4 ? 'fringe' : d.chance(0.3) ? 'sand' : 'rough'
    return Math.abs(offLine) <= 13 ? 'fairway' : 'rough'
  }

  // A full swing with `club` from pos toward `aim`.
  const fullSwing = (club: string, aim: Pt, teeShot: boolean): void => {
    const p = PLAY[club]!
    const a = dist(pos, aim)
    const rough = lie === 'rough' || lie === 'sand'
    // A full swing goes the club's number; Sam takes only a little off by feel.
    let along =
      (1 - FEEL) * (p.stock - a) +
      p.long +
      (rough ? -2 : 0) +
      d.normal(p.sdLong * (rough ? 1.1 : 1))
    let contact: ShotContact | null = d.chance(0.6) ? 'solid' : null
    if (d.chance(p.mishit * (rough ? 1.5 : 1))) {
      contact = d.chance(0.55) ? 'thin' : 'fat'
      along -= a * d.between(0.2, 0.45)
    }
    let startOff = p.start + d.normal(p.sdStart * (rough ? 1.2 : 1))
    let curve = p.curve + d.normal(p.sdCurve * (rough ? 1.2 : 1))
    let penalty = false
    let ob = false
    // A couple of honest disasters: a tee shot sliced out of bounds or hooked
    // into the water, and the odd long approach that finds a hazard.
    if (teeShot && d.chance(0.045)) {
      ob = true
      startOff = d.between(4, 10)
      curve = d.between(38, 50)
    } else if (teeShot && d.chance(0.04)) {
      penalty = true
      startOff = d.between(-12, -6)
      curve = d.between(-34, -26)
    } else if (aim === pin && a > 120 && d.chance(0.035)) {
      penalty = true
      startOff = d.between(4, 8)
      curve = d.between(16, 22)
    }
    const right = startOff + curve
    const end = offset(pos, aim, along, right)
    const lineThr = 2.5 + 0.015 * a
    const shapeThr = 2.5 + 0.012 * a
    const startLine: ShotStartLine =
      startOff > lineThr ? 'push' : startOff < -lineThr ? 'pull' : 'on_line'
    const shape: ShotShape =
      curve > 2.6 * shapeThr
        ? 'slice'
        : curve > shapeThr
          ? 'fade'
          : curve < -2.6 * shapeThr
            ? 'hook'
            : curve < -shapeThr
              ? 'draw'
              : 'straight'
    shots.push({
      start: pos,
      aim,
      end,
      club,
      lie,
      contact,
      startLine: d.chance(0.8) || ob || penalty ? startLine : null,
      shape: d.chance(0.85) || ob || penalty ? shape : null,
      penalty,
      ob,
    })
    if (ob) {
      // Stroke and distance: replay from (a yard or so from) the same spot.
      pos = { x: pos.x + d.normal(0.7), y: pos.y + d.normal(0.7) }
      return
    }
    if (penalty) {
      // Dropped beside the hazard, back toward the line of play.
      pos = offset(pos, aim, along - 6, right * 0.55)
      lie = 'rough'
      if (dist(pos, pin) <= greenRadius) pos = toward(pin, pos, greenRadius + 3)
      return
    }
    pos = end
    lie = lieAt(end, right)
  }

  // A pitch or chip by feel, no club, at the pin.
  const shortGame = (): void => {
    const r = dist(pos, pin)
    let end: Pt
    if (lie === 'sand' && d.chance(0.1)) {
      end = toward(pin, pos, Math.max(greenRadius + 1, r * 0.85))
    } else if (lie !== 'sand' && d.chance(lie === 'rough' ? 0.04 : 0.02)) {
      end = toward(pin, pos, Math.max(greenRadius + 1, r * d.between(0.5, 0.7)))
    } else if (lie !== 'sand' && r <= NEAR_GREEN_YARDS && d.chance(0.025)) {
      end = pin
    } else if (r > NEAR_GREEN_YARDS && d.chance(0.2)) {
      end = offset(pos, pin, d.between(-24, -greenRadius - 2), d.normal(4))
    } else {
      const ft =
        lie === 'sand'
          ? d.between(5, 26)
          : r > NEAR_GREEN_YARDS
            ? r * 3 * d.between(0.08, 0.3) + d.between(3, 8)
            : r * 3 * d.between(0.09, 0.32) + d.between(1, 3.5)
      // Past or short of the hole, a little either side.
      end = offset(pos, pin, ((d.chance(0.45) ? 1 : -1) * Math.min(ft, 42)) / 3, d.normal(0.8))
    }
    shots.push({
      start: pos,
      aim: pin,
      end,
      club: null,
      lie,
      contact: null,
      startLine: null,
      shape: null,
      penalty: false,
      ob: false,
    })
    pos = end
    const r2 = dist(end, pin)
    lie =
      r2 < 0.01
        ? 'holed'
        : r2 <= greenRadius
          ? 'green'
          : lie === 'sand' && r2 > r * 0.8
            ? 'sand'
            : r2 <= greenRadius + 4
              ? 'fringe'
              : 'rough'
  }

  const putt = (): void => {
    const ft = dist(pos, pin) * 3
    if (d.chance(makeChance(ft))) {
      shots.push({
        start: pos,
        aim: pin,
        end: pin,
        club: 'putter',
        lie: 'green',
        contact: null,
        startLine: null,
        shape: null,
        penalty: false,
        ob: false,
        putt: { made: true, distance: null, direction: null },
      })
      lie = 'holed'
      return
    }
    const leave = ft < 6 ? d.between(0.8, 2.2) : ft * d.between(0.06, 0.2) + d.between(0.3, 1.1)
    const long = d.chance(0.45)
    const side = d.chance(0.5) ? 1 : -1
    const end = offset(
      pos,
      pin,
      ((long ? 1 : -1) * Math.sqrt(Math.max(0.1, leave ** 2 - 0.25))) / 3,
      (side * 0.5) / 3,
    )
    shots.push({
      start: pos,
      aim: pin,
      end,
      club: 'putter',
      lie: 'green',
      contact: null,
      startLine: null,
      shape: null,
      penalty: false,
      ob: false,
      putt: {
        made: false,
        distance: long ? 'long' : 'short',
        direction: d.chance(0.65) ? (side > 0 ? 'right' : 'left') : null,
      },
    })
    pos = end
  }

  while (lie !== 'holed' && shots.length < 14) {
    const r = dist(pos, pin)
    if (lie === 'green') putt()
    else if (lie === 'tee' && hole.par >= 4) {
      // Driver unless it would leave a pitch; then the club that leaves a full wedge.
      const club = r - PLAY.driver!.stock >= 45 ? 'driver' : nearestClub(r - 100)
      fullSwing(club, toward(pos, pin, PLAY[club]!.stock), true)
    } else if (r <= PITCH_YARDS) shortGame()
    else if (r <= MAX_GO_FOR_IT) fullSwing(nearestClub(r + d.normal(JUDGE_SD)), pin, false)
    else {
      // Lay up to a full wedge: the club that leaves closest to 95 yd, never inside 70.
      const options = FAIRWAY_CLUBS.filter((c) => r - PLAY[c]!.stock >= 70)
      const club = (options.length ? options : ['3w']).reduce((best, c) =>
        Math.abs(r - PLAY[c]!.stock - 95) < Math.abs(r - PLAY[best]!.stock - 95) ? c : best,
      )
      fullSwing(club, toward(pos, pin, PLAY[club]!.stock), false)
    }
  }
  return shots
}
