// Number plates on the round map (#1208, #1215): each saved shot is a small
// dot with its number on a plate out to one side on a flat leader. Near the
// green the dots crowd, so each plate takes the side that covers least.
// Screen space (px/dp), y down. Both apps draw the plate at these boxes.

export type PlateSide = 'ur' | 'dr' | 'ul' | 'dl'
export type ScreenPt = [number, number]
type Box = [number, number, number, number]

// A plate's box around its dot (left, top, right, bottom), per side.
// ponytail: one-digit width; a 10+ plate runs ~9 wider and isn't accounted for.
const PLATE: Record<PlateSide, Box> = {
  ur: [20, -21, 40, -1],
  dr: [20, 1, 40, 21],
  ul: [-40, -21, -20, -1],
  dl: [-40, 1, -20, 21],
}
// Tie-break order: up-right first, then below it, then the left side.
const SIDES: PlateSide[] = ['ur', 'dr', 'ul', 'dl']
// The selected shot's disc is 44 across; keep plates out of its ring.
const SELECTED_RING = 22

export function plateBox(d: ScreenPt, side: PlateSide): Box {
  const r = PLATE[side]
  return [d[0] + r[0], d[1] + r[1], d[0] + r[2], d[1] + r[3]]
}

const overlaps = (a: Box, b: Box, m: number) =>
  a[0] < b[2] + m && a[2] > b[0] - m && a[1] < b[3] + m && a[3] > b[1] - m
const at = (p: ScreenPt): Box => [p[0], p[1], p[0], p[1]]

// In order, each plate takes the side that covers least: another plate counts
// worst, then the selected disc, then any other dot or `others` point (the pin).
export function fanPlates(dots: ScreenPt[], others: ScreenPt[], selected?: ScreenPt): PlateSide[] {
  const placed: Box[] = []
  const points = [...dots, ...others]
  return dots.map((d) => {
    const cost = (s: PlateSide) => {
      const b = plateBox(d, s)
      return (
        placed.filter((o) => overlaps(o, b, 2)).length * 100 +
        (selected && overlaps(b, at(selected), SELECTED_RING) ? 10 : 0) +
        points.filter((o) => o !== d && overlaps(b, at(o), 6)).length
      )
    }
    const side = SIDES.reduce((best, x) => (cost(x) < cost(best) ? x : best))
    placed.push(plateBox(d, side))
    return side
  })
}
