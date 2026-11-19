import type { GreenGrid } from '../codec'

/** A full rectangular green whose height (mm) is f(x m east, y m north) of cell (0,0)'s centre. */
export function gridOf(width: number, height: number, f: (x: number, y: number) => number, inside = (_x: number, _y: number) => true): GreenGrid {
  const mask = new Uint8Array(width * height)
  const heightsMm = new Float64Array(width * height).fill(NaN)
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++) {
      const x = c * 0.5
      const y = -r * 0.5
      if (!inside(x, y)) continue
      mask[r * width + c] = 1
      heightsMm[r * width + c] = f(x, y)
    }
  return { width, height, stepMm: 2, zMinMm: 0, mask, heightsMm }
}
