import { describe, expect, it } from 'vitest'
import { matchHoles, parseElements } from './osm-import'

const QUERY_CENTER = { lat: 55.9533, lon: -3.1883 }

function hole(ref: number, tee: { lat: number; lon: number }, pin: { lat: number; lon: number }) {
  return {
    ref,
    par: 4,
    yards: null,
    teeFromHole: tee,
    pinFromHole: pin,
    pathYards: 0,
  }
}

describe('matchHoles', () => {
  it('matches each hole to the nearest green/tee within MATCH_RADIUS_METERS', () => {
    const tee = { lat: 55.9533, lon: -3.1883 }
    const pin = { lat: 55.9543, lon: -3.1883 } // ~111m north of tee
    const nearGreen = { lat: 55.95431, lon: -3.1883 } // ~1m from pin — within radius
    const nearTee = { lat: 55.95331, lon: -3.1883 } // ~1m from tee — within radius

    const parsed = { holes: [hole(1, tee, pin)], greens: [nearGreen], tees: [nearTee] }
    const { matched, dedupedRefs } = matchHoles(parsed, QUERY_CENTER)

    expect(matched).toHaveLength(1)
    expect(matched[0]!.hasGreenMatch).toBe(true)
    expect(matched[0]!.hasTeeMatch).toBe(true)
    expect(matched[0]!.pin).toEqual(nearGreen)
    expect(matched[0]!.tee).toEqual(nearTee)
    expect(dedupedRefs).toEqual([])
  })

  it('falls back to the raw hole-way endpoints when nothing is within radius', () => {
    const tee = { lat: 55.9533, lon: -3.1883 }
    const pin = { lat: 55.9543, lon: -3.1883 }
    const farGreen = { lat: 56.5, lon: -3.1883 } // way outside 60m radius

    const parsed = { holes: [hole(5, tee, pin)], greens: [farGreen], tees: [] }
    const { matched } = matchHoles(parsed, QUERY_CENTER)

    expect(matched[0]!.hasGreenMatch).toBe(false)
    expect(matched[0]!.pin).toEqual(pin)
    expect(matched[0]!.hasTeeMatch).toBe(false)
    expect(matched[0]!.tee).toEqual(tee)
  })

  it('dedupes duplicate hole numbers by keeping the way closest to the query center', () => {
    const closeTee = { lat: 55.9533, lon: -3.1883 }
    const closePin = { lat: 55.9534, lon: -3.1883 }
    const farTee = { lat: 56.5, lon: -3.1883 }
    const farPin = { lat: 56.51, lon: -3.1883 }

    const parsed = {
      holes: [hole(7, farTee, farPin), hole(7, closeTee, closePin)],
      greens: [],
      tees: [],
    }
    const { matched, dedupedRefs } = matchHoles(parsed, QUERY_CENTER)

    expect(matched).toHaveLength(1)
    expect(matched[0]!.tee).toEqual(closeTee)
    expect(dedupedRefs).toEqual([7])
  })

  it('sorts matched holes by ref', () => {
    const t = { lat: 55.9533, lon: -3.1883 }
    const p = { lat: 55.9534, lon: -3.1883 }
    const parsed = { holes: [hole(3, t, p), hole(1, t, p), hole(2, t, p)], greens: [], tees: [] }
    const { matched } = matchHoles(parsed, QUERY_CENTER)
    expect(matched.map((h) => h.ref)).toEqual([1, 2, 3])
  })
})

describe('parseElements', () => {
  it('ignores hole ways with an out-of-range or unparseable ref', () => {
    const resp = {
      elements: [
        { type: 'node' as const, id: 1, lat: 1, lon: 1 },
        { type: 'node' as const, id: 2, lat: 2, lon: 2 },
        { type: 'way' as const, id: 10, nodes: [1, 2], tags: { golf: 'hole', ref: '19' } },
        { type: 'way' as const, id: 11, nodes: [1, 2], tags: { golf: 'hole', ref: '0' } },
        { type: 'way' as const, id: 12, nodes: [1, 2], tags: { golf: 'hole', ref: '9' } },
      ],
    }
    const { holes } = parseElements(resp)
    expect(holes.map((h) => h.ref)).toEqual([9])
  })
})
