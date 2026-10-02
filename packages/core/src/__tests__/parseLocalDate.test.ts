// A zone west of Greenwich, set before any Date is built: this is where a
// bare 'YYYY-MM-DD' parsed as UTC lands on the previous day (#914).
process.env.TZ = 'America/Chicago'

import { describe, expect, it } from 'vitest'
import { parseLocalDate } from '../units'

describe('parseLocalDate', () => {
  it('reads a date-only string as local midnight, not UTC', () => {
    const d = parseLocalDate('2026-09-25')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 25, 0])
    // The bug it replaces, so this test can fail in this zone.
    expect(new Date('2026-09-25').getDate()).toBe(24)
  })

  it('leaves a full timestamp alone', () => {
    expect(parseLocalDate('2026-09-25T18:30:00Z').getTime()).toBe(Date.UTC(2026, 8, 25, 18, 30))
  })

  it('gives an Invalid Date for junk', () => {
    expect(Number.isNaN(parseLocalDate('not a date').getTime())).toBe(true)
  })
})
