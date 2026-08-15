import { describe, expect, it } from 'vitest'
import { resolveCourseTee, resolveHole, type HoleBase } from './hole-tees'

const base: HoleBase = {
  par: 4,
  yards: 380,
  stroke_index: 7,
  tee_lat: 55.95,
  tee_lng: -3.19,
}

describe('resolveHole', () => {
  it('falls through to base when no tee override exists (the common case — sparse data)', () => {
    expect(resolveHole(base, null)).toEqual({
      par: 4,
      yards: 380,
      strokeIndex: 7,
      teeLat: 55.95,
      teeLng: -3.19,
    })
  })

  it('applies a tee override for yards/par/stroke_index/tee location', () => {
    const resolved = resolveHole(base, {
      yards: 350,
      par: 5,
      stroke_index: 3,
      tee_lat: 55.951,
      tee_lng: -3.191,
    })
    expect(resolved).toEqual({
      par: 5,
      yards: 350,
      strokeIndex: 3,
      teeLat: 55.951,
      teeLng: -3.191,
    })
  })

  it('a partial tee override only overrides the fields it sets', () => {
    const resolved = resolveHole(base, {
      yards: 350,
      par: null,
      stroke_index: null,
      tee_lat: null,
      tee_lng: null,
    })
    expect(resolved).toEqual({
      par: 4,
      yards: 350,
      strokeIndex: 7,
      teeLat: 55.95,
      teeLng: -3.19,
    })
  })

  it('round override par wins over tee override par', () => {
    const resolved = resolveHole(
      base,
      { yards: 350, par: 5, stroke_index: 3, tee_lat: null, tee_lng: null },
      { par: 6 },
    )
    expect(resolved.par).toBe(6)
  })

  it('live override tee location wins over everything else', () => {
    const resolved = resolveHole(
      base,
      { yards: null, par: null, stroke_index: null, tee_lat: 10, tee_lng: 10 },
      { tee_lat: 20, tee_lng: 20 },
      { tee_lat: 30, tee_lng: 30 },
    )
    expect(resolved.teeLat).toBe(30)
    expect(resolved.teeLng).toBe(30)
  })
})

describe('resolveCourseTee', () => {
  const tees = [
    { id: 't1', tee_color: 'white' },
    { id: 't2', tee_color: 'blue' },
  ] as Parameters<typeof resolveCourseTee>[0]

  it('prefers matching by id', () => {
    expect(resolveCourseTee(tees, 't2', 'white')?.id).toBe('t2')
  })

  it('falls back to tee_color when id does not match', () => {
    expect(resolveCourseTee(tees, 'nonexistent', 'blue')?.id).toBe('t2')
  })

  it('falls back to tee_color when id is absent', () => {
    expect(resolveCourseTee(tees, null, 'white')?.id).toBe('t1')
  })

  it('matches tee_color case-insensitively (round.tee_color casing is not guaranteed)', () => {
    expect(resolveCourseTee(tees, null, 'White')?.id).toBe('t1')
    expect(resolveCourseTee(tees, null, 'BLUE')?.id).toBe('t2')
  })

  it('returns null when neither id nor color match', () => {
    expect(resolveCourseTee(tees, null, null)).toBeNull()
    expect(resolveCourseTee(tees, 'nope', 'green')).toBeNull()
  })
})
