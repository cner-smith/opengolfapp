import { describe, expect, it } from 'vitest'
import { applyCapturedShots, reviewedPuttLengthFt, reviewedRowToShotFields, type ReviewedShotRow } from '../round'

const row = (overrides: Partial<ReviewedShotRow> = {}): ReviewedShotRow => ({
  shotNumber: 3,
  club: 'lw',
  lieType: 'rough',
  startLat: 43.84815,
  startLng: -87.73118,
  endLat: 43.848005,
  endLng: -87.730849,
  distanceYards: 30,
  distanceToPin: 30,
  isLastShot: true,
  ...overrides,
})

describe('applyCapturedShots', () => {
  it('keeps a live putt a putt when geometry guessed a wedge from the rough', () => {
    const [out] = applyCapturedShots(
      [row()],
      [{ club: 'putter', lie_type: 'green', putt_result: 'made' }],
    )
    expect(out).toMatchObject({ club: 'putter', lieType: 'green', puttMade: true })
  })

  it('does not call a live missed putt made, even as the last shot', () => {
    const [out] = applyCapturedShots(
      [row({ club: 'putter', lieType: 'green', puttMade: true })],
      [{ club: 'putter', lie_type: 'green', putt_result: null }],
    )
    expect(out!.puttMade).toBeUndefined()
  })

  it('leaves the inferred row alone when the round stored no club or lie', () => {
    const inferred = row({ club: 'putter', lieType: 'green', puttMade: true })
    const out = applyCapturedShots(
      [inferred, row({ shotNumber: 4 })],
      [{ club: null, lie_type: null, putt_result: null }],
    )
    expect(out[0]).toEqual(inferred)
    expect(out[1]).toEqual(row({ shotNumber: 4 }))
  })

  // #1481: a putt saved at 8 ft whose start the map puts 29 ft (9.67 yd) from
  // the pin. The review shows 8 ft and its save writes 8, not 29.
  it("keeps a live putt's saved length so the review shows and saves it", () => {
    const [out] = applyCapturedShots(
      [row({ distanceToPin: 29 / 3 })],
      [{ club: 'putter', lie_type: 'green', putt_result: 'made', putt_distance_ft: 8 }],
    )
    expect(out!.puttLengthFt).toBe(8)
    expect(reviewedPuttLengthFt(out!)).toBe(8)
    expect(reviewedRowToShotFields(out!, false).putt_distance_ft).toBe(8)
  })

  it('a putt with no saved length (or an old cache without it) still reads the map', () => {
    const [none, old] = applyCapturedShots(
      [row({ distanceToPin: 29 / 3 }), row({ distanceToPin: 29 / 3 })],
      [
        { club: 'putter', lie_type: 'green', putt_result: null, putt_distance_ft: null },
        { club: 'putter', lie_type: 'green', putt_result: null },
      ],
    )
    expect(none!.puttLengthFt).toBeUndefined()
    expect(old!.puttLengthFt).toBeUndefined()
    expect(reviewedPuttLengthFt(none!)).toBe(29)
  })

  it('a saved length on a shot that is no longer a putt is not carried', () => {
    const [out] = applyCapturedShots(
      [row()],
      [{ club: 'lw', lie_type: 'rough', putt_result: null, putt_distance_ft: 8 }],
    )
    expect(out!.puttLengthFt).toBeUndefined()
  })

  it('does not mutate the rows it was given', () => {
    const input = row()
    const before = { ...input }
    applyCapturedShots([input], [{ club: 'putter', lie_type: 'green', putt_result: 'made' }])
    expect(input).toEqual(before)
  })
})
