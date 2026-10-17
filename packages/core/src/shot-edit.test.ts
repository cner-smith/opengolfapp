import { describe, it, expect } from 'vitest'
import { insertedShotStart, projectShotMove } from './shot-edit'
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

  it('a putt with a pin: putt length = start → pin in whole feet (#1096)', () => {
    // 15 yd north of the pin on its meridian: 45 ft.
    const near = { lat: pin.lat - (15 * 0.9144) / 6371000 * (180 / Math.PI), lng: pin.lng }
    expect(projectShotMove({ newStart: near, pin, isPutt: true }).puttDistanceFt).toBe(45)
  })

  it('leaves the putt length unchanged (undefined) for a full shot or with no pin', () => {
    expect(projectShotMove({ newStart: start, pin, isPutt: false }).puttDistanceFt).toBeUndefined()
    expect(projectShotMove({ newStart: start, pin: null, isPutt: true }).puttDistanceFt).toBeUndefined()
  })

  it('treats coordinate 0 as a real coordinate, not falsy', () => {
    const proj = projectShotMove({ newStart: { lat: 0, lng: 0 }, pin: { lat: 0.01, lng: 0.01 }, isPutt: false })
    expect(proj.startLat).toBe(0)
    expect(proj.startLng).toBe(0)
    expect(typeof proj.distanceToTarget).toBe('number')
    expect(proj.distanceToTarget).toBeGreaterThan(0)
  })
})

describe('insertedShotStart', () => {
  it('puts a shot inserted between two others halfway between them', () => {
    const at = insertedShotStart({ lat: 43, lng: -87 }, { lat: 43.002, lng: -87.002 }, null)
    expect(at.lat).toBeCloseTo(43.001, 9)
    expect(at.lng).toBeCloseTo(-87.001, 9)
  })

  it('puts a shot inserted after the last one 20 yd toward the pin', () => {
    // 0.001° of latitude ≈ 121.6 yd: a pin due north, well past 20 yd.
    const at = insertedShotStart({ lat: 43, lng: -87 }, null, { lat: 43.001, lng: -87 })
    expect(haversineYards(43, -87, at.lat, at.lng)).toBeCloseTo(20, 1)
    expect(at.lng).toBeCloseTo(-87, 9)
    expect(at.lat).toBeGreaterThan(43)
  })

  it('stops halfway to a pin closer than 40 yd', () => {
    const at = insertedShotStart({ lat: 43, lng: -87 }, null, { lat: 43.0002, lng: -87 })
    expect(at.lat).toBeCloseTo(43.0001, 7)
  })

  it('goes 20 yd north with no pin', () => {
    const at = insertedShotStart({ lat: 43, lng: -87 }, null, null)
    expect(haversineYards(43, -87, at.lat, at.lng)).toBeCloseTo(20, 1)
    expect(at.lat).toBeGreaterThan(43)
  })
})
