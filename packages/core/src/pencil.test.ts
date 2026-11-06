import { describe, expect, it } from 'vitest'
import { marksFor, marksPath, pencilEllipse, pencilTick } from './pencil'

describe('pencil marks', () => {
  it('draws nothing at par, one gesture for birdie / bogey, two for eagle / double', () => {
    expect(marksFor(0, 3)).toEqual([])
    expect(marksFor(-1, 3)).toHaveLength(1)
    expect(marksFor(1, 3)).toHaveLength(1)
    const eagle = marksFor(-2, 3)
    const double = marksFor(3, 3)
    expect(eagle).toHaveLength(2)
    expect(double).toHaveLength(2)
    // The second gesture starts 50 ms after the first ends.
    expect(eagle[1]!.at).toBe(eagle[0]!.m.dur + 50)
    expect(double[1]!.at).toBe(double[0]!.m.dur + 50)
  })

  it('is seeded: the same hole draws the same mark on web and mobile', () => {
    expect(marksFor(-1, 7)).toEqual(marksFor(-1, 7))
    expect(pencilTick(7)).toEqual(pencilTick(7))
    expect(marksFor(-1, 7)).not.toEqual(marksFor(-1, 8))
    expect(pencilTick(7)).not.toEqual(pencilTick(8))
  })
})

describe('marksPath', () => {
  it('draws the mark over time: nothing before it starts, more as it goes, then the full outline', () => {
    const ms = marksFor(-1, 3)
    const full = marksPath(ms, 1e9)
    expect(marksPath(ms, 0)).toBe('')
    expect(full).toMatch(/^M[\d.-]+ [\d.-]+ Q.*Z$/)
    expect(marksPath(ms, ms[0]!.m.dur / 2).length).toBeLessThan(full.length)
  })
})

describe('pencilEllipse', () => {
  // Half-extents of the drawn line, from its points.
  const extent = (ms: ReturnType<typeof pencilEllipse>) => {
    const pts = ms.flatMap((x) => x.m.strokes.flatMap((st) => st.pts))
    return { x: Math.max(...pts.map((p) => Math.abs(p.x))), y: Math.max(...pts.map((p) => Math.abs(p.y))) }
  }

  it('turns a long ring by its tilt: upright at 90°, lying flat at 0°', () => {
    // a = 40, b = 10. Flat, the line reaches about 40 across and 10 down;
    // turned 90° it is the other way round. The hand wobbles and drifts
    // outward by up to ~15%, so the checks leave that much room.
    const flat = extent(pencilEllipse(40, 10, 400, 3, 0))
    const upright = extent(pencilEllipse(40, 10, 400, 3, 90))
    expect(flat.x).toBeGreaterThan(38)
    expect(flat.y).toBeLessThan(13)
    expect(upright.y).toBeGreaterThan(38)
    expect(upright.x).toBeLessThan(13)
  })

  it('keeps the old slight lean when no tilt is given', () => {
    expect(pencilEllipse(29, 12, 220, 7)).toEqual(pencilEllipse(29, 12, 220, 7, -6))
  })
})
