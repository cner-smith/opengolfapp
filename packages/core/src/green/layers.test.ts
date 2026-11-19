import { describe, expect, it } from 'vitest'
import { greenLayersVisible } from './layers'

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
