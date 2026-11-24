import { describe, expect, it } from 'vitest'
import type { GreenGrid } from './codec'
import { MIN_OUTLINE_COVERAGE } from './frame'
import { greenLayersVisible, heatMapHideReason, playerOutlineHideReason, playerOutlineSurvey } from './layers'

// The fixed marks: the outline, the pin and the margin bars always show;
// the rails show only while the flag is held.
const KEEP = { outline: true, pin: true, bars: true }

describe('greenLayersVisible', () => {
  it('Slope with lidar and pace lines on: the picture, the marks and the lines, no rails', () => {
    expect(greenLayersVisible({ held: false, view: 'slope', lidar: true, paceLines: true })).toEqual({
      ...KEEP,
      colour: true,
      hachures: true,
      contours: false,
      tags: false,
      paceLines: true,
      rails: false,
    })
  })

  it('Height with lidar: the picture, contours and low/high tags, no marks', () => {
    expect(greenLayersVisible({ held: false, view: 'height', lidar: true, paceLines: false })).toEqual({
      ...KEEP,
      colour: true,
      hachures: false,
      contours: true,
      tags: true,
      paceLines: false,
      rails: false,
    })
  })

  it('held: only the outline, the pin, the rails and the bars, whatever the toggles', () => {
    const held = { ...KEEP, colour: false, hachures: false, contours: false, tags: false, paceLines: false, rails: true }
    for (const view of ['slope', 'height', 'plain'] as const) {
      for (const paceLines of [true, false]) {
        expect(greenLayersVisible({ held: true, view, lidar: true, paceLines })).toEqual(held)
        expect(greenLayersVisible({ held: true, view, lidar: false, paceLines })).toEqual(held)
      }
    }
  })

  it('release restores exactly what showed before the hold', () => {
    const toggles = { view: 'height', lidar: true, paceLines: true } as const
    const before = greenLayersVisible({ held: false, ...toggles })
    greenLayersVisible({ held: true, ...toggles })
    expect(greenLayersVisible({ held: false, ...toggles })).toEqual(before)
    expect(before).toEqual({ ...KEEP, colour: true, hachures: false, contours: true, tags: true, paceLines: true, rails: false })
  })

  it('Plain shows no colour, marks, contours or tags; pace lines follow their own toggle', () => {
    expect(greenLayersVisible({ held: false, view: 'plain', lidar: true, paceLines: true })).toEqual({
      ...KEEP,
      colour: false,
      hachures: false,
      contours: false,
      tags: false,
      paceLines: true,
      rails: false,
    })
  })

  it('no lidar: no colour and no marks, even in Slope', () => {
    expect(greenLayersVisible({ held: false, view: 'slope', lidar: false, paceLines: false })).toEqual({
      ...KEEP,
      colour: false,
      hachures: false,
      contours: false,
      tags: false,
      paceLines: false,
      rails: false,
    })
    expect(greenLayersVisible({ held: false, view: 'height', lidar: false, paceLines: true }).contours).toBe(false)
  })
})

describe('heatMapHideReason', () => {
  it('shows a green of ordinary tilt with no outline flag', () => {
    expect(heatMapHideReason(3.1, null)).toBeNull()
    expect(heatMapHideReason(10, '')).toBeNull()
  })

  it('shows a flagged outline unless it is too big (the middle band shows)', () => {
    expect(heatMapHideReason(6.5, 'solidity,shade_edge,lidar_shade_overrun')).toBeNull()
    expect(heatMapHideReason(2, 'area_small')).toBeNull()
  })

  it('hides an outline flagged far too big, whatever its tilt', () => {
    expect(heatMapHideReason(6.5, 'area_large,solidity,shade_edge')).toBe('outline far bigger than a green')
    expect(heatMapHideReason(null, 'solidity, area_large')).toBe('outline far bigger than a green')
  })

  it('hides a green that tilts more than 10%', () => {
    expect(heatMapHideReason(10.5, null)).toBe('tilts 10.5%, steeper than a green')
    expect(heatMapHideReason(14.26, 'start_moved')).toBe('tilts 14.3%, steeper than a green')
  })

  it('shows when there is no tilt to judge', () => {
    expect(heatMapHideReason(null, null)).toBeNull()
  })
})

describe('playerOutlineHideReason', () => {
  it('judges a player outline afresh when our outline was hidden as too big or too steep', () => {
    expect(playerOutlineHideReason(true, 'outline far bigger than a green', 4.2)).toBeNull()
    expect(playerOutlineHideReason(true, 'tilts 12.0%, steeper than a green', 3)).toBeNull()
  })

  it('still hides a player outline that tilts more than 10%', () => {
    expect(playerOutlineHideReason(true, 'outline far bigger than a green', 11)).toBe('tilts 11.0%, steeper than a green')
    expect(playerOutlineHideReason(false, null, 10.5)).toBe('tilts 10.5%, steeper than a green')
  })

  it('keeps a survey hidden for a reason that is not about the outline', () => {
    expect(playerOutlineHideReason(true, 'lidar predates the green', 2)).toBe('lidar predates the green')
    expect(playerOutlineHideReason(true, null, 2)).toBe('flagged')
  })

  it('shows an unflagged survey of ordinary tilt', () => {
    expect(playerOutlineHideReason(false, null, 3)).toBeNull()
  })
})

describe('playerOutlineSurvey', () => {
  // 20×20 cells (10 m square), all surveyed. Cell (r, c) centre is c·0.5 m east, r·0.5 m south of (LNG0, LAT0).
  const LAT0 = 35.6, LNG0 = -97.6, M = 111_320, KX = M * Math.cos((LAT0 * Math.PI) / 180)
  const geo = (east: number, south: number) => ({ lat: LAT0 - south / M, lng: LNG0 + east / KX })
  const grid = (slopePerCell: number): GreenGrid => ({
    width: 20, height: 20, stepMm: 2, zMinMm: 0,
    mask: new Uint8Array(400).fill(1),
    // Heights fall eastward: slopePerCell mm per 0.5 m cell.
    heightsMm: Float64Array.from({ length: 400 }, (_, j) => 1000 - (j % 20) * slopePerCell),
  })
  const inside = [geo(0.75, 0.75), geo(8.25, 0.75), geo(8.25, 8.25), geo(0.75, 8.25)]

  it('cuts the grid to a covered outline and gives its tilt', () => {
    const r = playerOutlineSurvey(grid(10), LNG0, LAT0, inside, false, null)
    if ('hidden' in r) throw new Error(`hidden: ${r.hidden}`)
    expect(r.grid.mask.reduce((a, b) => a + b, 0)).toBe(15 * 15)
    expect(r.tilt?.tiltPct).toBeCloseTo(2, 1)
  })

  it('hides an outline the survey covers less than MIN_OUTLINE_COVERAGE of', () => {
    // Half of this square lies east of the grid.
    expect(playerOutlineSurvey(grid(10), LNG0, LAT0, [geo(4.75, 0.75), geo(14.25, 0.75), geo(14.25, 8.25), geo(4.75, 8.25)], false, null)).toEqual({ hidden: 'not_reached' })
    expect(MIN_OUTLINE_COVERAGE).toBe(0.97)
  })

  it('shows a player outline our size rule hid, and hides it when the green is steeper than 10%', () => {
    expect('grid' in playerOutlineSurvey(grid(10), LNG0, LAT0, inside, true, 'outline far bigger than a green')).toBe(true)
    // 60 mm per 0.5 m = 12%.
    expect(playerOutlineSurvey(grid(60), LNG0, LAT0, inside, true, 'outline far bigger than a green')).toEqual({ hidden: 'suspect' })
  })

  it('keeps a survey flagged for another reason hidden', () => {
    expect(playerOutlineSurvey(grid(10), LNG0, LAT0, inside, true, 'lidar predates the green')).toEqual({ hidden: 'suspect' })
  })
})
