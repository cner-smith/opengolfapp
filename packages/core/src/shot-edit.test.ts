import { describe, it, expect } from 'vitest'
import { projectShotMove } from './shot-edit'
import { haversineYards } from './units'

describe('projectShotMove', () => {
  const pin = { lat: 35.01, lng: -97.51 }
  const start = { lat: 35.0, lng: -97.5 }

  it('recomputes distance_to_target = round(haversine start→pin) for a full shot', () => {
    const proj = projectShotMove({ newStart: start, pin, isPutt: false })
    const expected = Math.round(haversineYards(start.lat, start.lng, pin.lat, pin.lng))
    expect(proj.distanceToTarget).toBe(expected)
    expect(proj.startLat).toBe(35.0)
    expect(proj.startLng).toBe(-97.5)
  })

  it('clears distance_to_target to null for a putt (green lie)', () => {
    const proj = projectShotMove({ newStart: start, pin, isPutt: true })
    expect(proj.distanceToTarget).toBeNull()
  })

  it('leaves distance_to_target unchanged (undefined) when there is no pin (#662)', () => {
    const proj = projectShotMove({ newStart: start, pin: null, isPutt: false })
    expect(proj.distanceToTarget).toBeUndefined()
  })

  it('a putt with no pin still clears to null (putt rule wins)', () => {
    const proj = projectShotMove({ newStart: start, pin: null, isPutt: true })
    expect(proj.distanceToTarget).toBeNull()
  })

  it('treats coordinate 0 as a real coordinate, not falsy', () => {
    const proj = projectShotMove({ newStart: { lat: 0, lng: 0 }, pin: { lat: 0.01, lng: 0.01 }, isPutt: false })
    expect(proj.startLat).toBe(0)
    expect(proj.startLng).toBe(0)
    expect(typeof proj.distanceToTarget).toBe('number')
    expect(proj.distanceToTarget).toBeGreaterThan(0)
  })
})
