// Number plates on the round map (#1208, #1215): each saved shot is a small
// dot with its number on a plate out to one side on a flat leader. Near the
// green the dots crowd, so each plate takes the side that covers least.
// Screen space (px/dp), y down. Both apps draw the plate at these boxes.

export type PlateSide = 'ur' | 'dr' | 'ul' | 'dl'
export type ScreenPt = [number, number]
type Box = [number, number, number, number]

// A plate's box around its dot (left, top, right, bottom), per side, for a
// plate `w` wide. The plate starts 20 out from the dot and grows away from it.
const PLATE: Record<PlateSide, (w: number) => Box> = {
  ur: (w) => [20, -21, 20 + w, -1],
  dr: (w) => [20, 1, 20 + w, 21],
  ul: (w) => [-20 - w, -21, -20, -1],
  dl: (w) => [-20 - w, 1, -20, 21],
}
const NUMBER_ONLY = 20

// How wide shot n's plate is drawn (#737): 20 for a one-digit number, 9 more
// per extra digit; a club ("1 | Dr") adds a divider and about 7 a character.
// Both apps draw the plate at exactly this width.
export function plateWidth(n: number, club?: string | null): number {
  const digits = String(n).length
  if (!club) return NUMBER_ONLY + 9 * (digits - 1)
  return 19 + 9 * digits + 7 * club.length
}

// Tie-break order: up-right first, then below it, then the left side.
const SIDES: PlateSide[] = ['ur', 'dr', 'ul', 'dl']
// The selected shot's disc is 44 across; keep plates out of its ring.
const SELECTED_RING = 22

export function plateBox(d: ScreenPt, side: PlateSide, w = NUMBER_ONLY): Box {
  const r = PLATE[side](w)
  return [d[0] + r[0], d[1] + r[1], d[0] + r[2], d[1] + r[3]]
}

const overlaps = (a: Box, b: Box, m: number) =>
  a[0] < b[2] + m && a[2] > b[0] - m && a[1] < b[3] + m && a[3] > b[1] - m
const at = (p: ScreenPt): Box => [p[0], p[1], p[0], p[1]]

// In order, each plate takes the side that covers least: another plate counts
// worst, then the selected disc, then any other dot or `others` point (the pin).
// `widths` is each plate's plateWidth; unset = a one-digit number.
export function fanPlates(dots: ScreenPt[], others: ScreenPt[], selected?: ScreenPt, widths?: number[]): PlateSide[] {
  const placed: Box[] = []
  const points = [...dots, ...others]
  return dots.map((d, i) => {
    const w = widths?.[i] ?? NUMBER_ONLY
    const cost = (s: PlateSide) => {
      const b = plateBox(d, s, w)
      return (
        placed.filter((o) => overlaps(o, b, 2)).length * 100 +
        (selected && overlaps(b, at(selected), SELECTED_RING) ? 10 : 0) +
        points.filter((o) => o !== d && overlaps(b, at(o), 6)).length
      )
    }
    const side = SIDES.reduce((best, x) => (cost(x) < cost(best) ? x : best))
    placed.push(plateBox(d, side, w))
    return side
  })
}
