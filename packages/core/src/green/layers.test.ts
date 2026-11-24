import { describe, expect, it } from 'vitest'
import { greenLayersVisible, heatMapHideReason, playerOutlineHideReason } from './layers'

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
