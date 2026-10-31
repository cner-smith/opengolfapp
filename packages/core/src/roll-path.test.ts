import { describe, expect, it } from 'vitest'
import { ROLL, buildRollPaths, type RollTable } from './roll-path'

const { lip, hole, cup, holeDy, coverFrom, coverTo } = buildRollPaths()
const at = (a: number[], i: number) => a[i] as number
const firstDrop = (t: RollTable) => t.drop.findIndex((d) => d > 0)
const biggestStep = (a: number[], from = 0, to = a.length) => {
  let max = 0
  for (let i = from + 1; i < to; i++) max = Math.max(max, Math.abs(at(a, i) - at(a, i - 1)))
  return max
}

describe('roll paths: both outcomes', () => {
  it('start the same: same ball line, same speed, same cup slide', () => {
    expect(at(lip.x, 0)).toBeCloseTo(at(hole.x, 0), 6)
    expect(at(lip.y, 0)).toBeCloseTo(at(hole.y, 0), 6)
    expect(at(lip.speed, 0)).toBe(ROLL.vStart)
    expect(at(lip.scroll, 0)).toBeCloseTo(at(hole.scroll, 0), 6)
  })

  it('finish the cup slide before the ball reaches the rim', () => {
    for (const t of [lip, hole]) expect(at(t.scroll, firstDrop(t))).toBeLessThan(1)
    expect(Math.abs(at(lip.scroll, lip.n - 1))).toBeLessThan(0.5)
  })

  it('reach the rim soon after the cup appears, the hole-in first', () => {
    expect(firstDrop(hole) * ROLL.dt).toBeLessThan(0.85)
    expect(firstDrop(lip) * ROLL.dt).toBeLessThan(0.95)
    expect(firstDrop(hole)).toBeLessThan(firstDrop(lip))
  })
})

describe('roll paths: lip-out', () => {
  it('has no jump in position or speed anywhere', () => {
    expect(biggestStep(lip.speed)).toBeLessThan(5)
    expect(biggestStep(lip.x)).toBeLessThan(3.2)
    expect(biggestStep(lip.y)).toBeLessThan(1.5)
  })

  it('never reverses along the path', () => {
    expect(Math.min(...lip.speed)).toBeGreaterThan(-20)
  })

  it('horseshoes: passes the cup centre, swings round the near side, comes back left of it', () => {
    const far = lip.x.indexOf(Math.max(...lip.x))
    expect(at(lip.x, far)).toBeGreaterThan(cup.x + 20)
    expect(at(lip.x, lip.n - 1)).toBeLessThan(cup.x - cup.r)
    const near = lip.y.indexOf(Math.max(...lip.y))
    expect(near).toBeGreaterThan(far)
    expect(at(lip.y, near)).toBeGreaterThan(cup.y)
  })

  it('dips below the rim on the near side and climbs back out', () => {
    expect(Math.max(...lip.drop)).toBeGreaterThan(10)
    expect(at(lip.drop, lip.n - 1)).toBe(0)
  })

  it('leaves slower than it arrived and stops', () => {
    const rim = firstDrop(lip)
    const out = lip.drop.findIndex((d, i) => i > rim && d === 0)
    expect(at(lip.speed, out)).toBeLessThan(at(lip.speed, rim) * 0.7)
    expect(Math.abs(at(lip.speed, lip.n - 1))).toBeLessThan(6)
  })

  it('gains speed dropping into the lip and loses it climbing out', () => {
    const rim = firstDrop(lip)
    const near = lip.y.indexOf(Math.max(...lip.y))
    const fastest = Math.max(...lip.speed.slice(rim, near))
    expect(fastest).toBeGreaterThan(at(lip.speed, rim) + 1)
  })

  it('takes about 3 s from the rim to rest', () => {
    const sec = (lip.n - firstDrop(lip)) * ROLL.dt
    expect(sec).toBeGreaterThan(2.5)
    expect(sec).toBeLessThan(3.5)
  })

  it('lifts the cover while the ball climbs back over the near lip', () => {
    const near = lip.y.indexOf(Math.max(...lip.y))
    expect(coverFrom).toBeGreaterThan(near)
    expect(coverTo).toBeGreaterThan(coverFrom)
    expect(at(lip.drop, coverTo)).toBeGreaterThan(0)
  })
})

describe('roll paths: hole-in', () => {
  it('runs along the line through the cup centre', () => {
    expect(cup.y + holeDy).toBeCloseTo(at(hole.y, 0), 6)
    expect(holeDy).toBeLessThan(0)
  })

  it('starts to fall as the ball centre passes the left rim', () => {
    const oneSample = ROLL.vStart * ROLL.dt
    expect(Math.abs(at(hole.x, firstDrop(hole)) - (cup.x - cup.r))).toBeLessThan(oneSample)
  })

  it('keeps its forward speed through the fall', () => {
    const rim = firstDrop(hole)
    const speed = at(hole.speed, rim)
    for (let i = rim; i < hole.n; i++) expect(at(hole.speed, i)).toBe(speed)
    const steps = hole.dx.slice(rim + 1)
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(1e-6)
  })

  it('falls under constant gravity once the ball has tipped', () => {
    const start = firstDrop(hole) + Math.ceil(ROLL.tipT / ROLL.dt) + 1
    const expected = ROLL.dropG * ROLL.dt * ROLL.dt
    for (let i = start; i < start + 20; i++) {
      const second = at(hole.drop, i + 1) - 2 * at(hole.drop, i) + at(hole.drop, i - 1)
      expect(second).toBeCloseTo(expected, 2)
    }
  })

  it('is behind the near lip about 0.3 s after the rim, then the cup holds empty', () => {
    const line = at(hole.y, 0)
    const gone = hole.y.findIndex((y) => y > line + cup.r * ROLL.k + ROLL.ballR * (1 + ROLL.cos) + 1)
    const fall = (gone - firstDrop(hole)) * ROLL.dt
    expect(fall).toBeGreaterThan(0.2)
    expect(fall).toBeLessThan(0.35)
    expect((hole.n - gone) * ROLL.dt).toBeCloseTo(0.45, 1)
  })
})
