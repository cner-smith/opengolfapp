import { describe, expect, it } from 'vitest'
import { matchHoles, parseElements, upsertOsmGreenMaps, type OsmGreenMapFn } from './osm-import'
import type { OgaSupabaseClient } from './client'

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

  it('keeps every green as its outer ways, multipolygon relations included, without snapping pins to relations', () => {
    const resp: Parameters<typeof parseElements>[0] = {
      elements: [
        { type: 'node' as const, id: 1, lat: 0, lon: 0 },
        { type: 'node' as const, id: 2, lat: 0, lon: 1 },
        { type: 'node' as const, id: 3, lat: 1, lon: 1 },
        { type: 'node' as const, id: 4, lat: 1, lon: 0 },
        // A closed golf=green way.
        { type: 'way' as const, id: 20, nodes: [1, 2, 3, 1], tags: { golf: 'green' } },
        // A multipolygon green whose outer ring is split into two untagged ways, plus an inner.
        {
          type: 'relation' as const,
          id: 30,
          members: [
            { type: 'way', ref: 21, role: 'outer' },
            { type: 'way', ref: 22, role: 'outer' },
            { type: 'way', ref: 23, role: 'inner' },
          ],
          tags: { golf: 'green', type: 'multipolygon' },
        },
        { type: 'way' as const, id: 21, nodes: [1, 2, 3] },
        { type: 'way' as const, id: 22, nodes: [3, 4, 1] },
        { type: 'way' as const, id: 23, nodes: [2, 3, 4] },
      ],
    }
    const { greens, greenOutlines } = parseElements(resp)
    const pt = (lat: number, lng: number) => ({ lat, lng })
    expect(greenOutlines).toEqual([
      [[pt(0, 0), pt(0, 1), pt(1, 1)], [pt(1, 1), pt(1, 0), pt(0, 0)]],
      [[pt(0, 0), pt(0, 1), pt(1, 1), pt(0, 0)]],
    ])
    // The pin still snaps only to way greens, as before.
    expect(greens).toHaveLength(1)
  })
})

describe('upsertOsmGreenMaps', () => {
  // Stub: green_maps already holds a manual outline on h1 and an OSM outline 'same' on h2.
  function stubClient(existing: { hole_id: string; outline: string; outline_source: string }[]) {
    const upserts: unknown[][] = []
    const client = {
      from: () => ({
        select: () => ({ in: async () => ({ data: existing, error: null }) }),
        upsert: async (rows: unknown[]) => {
          upserts.push(rows)
          return { error: null }
        },
      }),
    } as unknown as OgaSupabaseClient
    return { client, upserts }
  }
  const pt = { lat: 0, lon: 0 }
  const matched = (ref: number) => ({
    ref, par: 4, yards: null, tee: pt, pin: pt, greenEnd: pt, hasGreenMatch: true, hasTeeMatch: true,
  })
  const greenMap: OsmGreenMapFn = () => ({ outline: 'same', areaM2: 500.04, flagged: true, flagReason: 'nearest green, 3 m from the hole\'s end' })

  it('never replaces a manual outline, skips an unchanged OSM one, and writes the rest', async () => {
    const { client, upserts } = stubClient([
      { hole_id: 'h1', outline: 'traced', outline_source: 'manual' },
      { hole_id: 'h2', outline: 'same', outline_source: 'osm' },
    ])
    const got = await upsertOsmGreenMaps(
      client,
      [{ id: 'h1', hole: matched(1) }, { id: 'h2', hole: matched(2) }, { id: 'h3', hole: matched(3) }],
      [],
      greenMap,
    )
    expect(got).toEqual({ written: 1, flaggedRefs: [1, 2, 3], missingRefs: [] })
    expect(upserts).toEqual([
      [
        {
          hole_id: 'h3',
          outline: 'same',
          area_m2: 500,
          outline_source: 'osm',
          outline_score: null,
          outline_flagged: true,
          outline_flag_reason: "nearest green, 3 m from the hole's end",
        },
      ],
    ])
  })

  it('reports holes with no green and writes nothing for them', async () => {
    const { client, upserts } = stubClient([])
    const got = await upsertOsmGreenMaps(client, [{ id: 'h1', hole: matched(7) }], [], () => null)
    expect(got).toEqual({ written: 0, flaggedRefs: [], missingRefs: [7] })
    expect(upserts).toEqual([])
  })
})
