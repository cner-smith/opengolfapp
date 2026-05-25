import { describe, expect, it } from 'vitest'
import * as OgaCore from '@oga/core'

// Catches barrel drift: a missing or renamed re-export in index.ts would
// break consumers (web/mobile) but leave module-scoped tests green. We pin
// the load-bearing named exports — not every symbol — so this stays cheap
// to maintain when new helpers land.
describe('@oga/core barrel', () => {
  it.each<[keyof typeof OgaCore]>([
    ['shotRowToDraft'],
    ['sgBreakdown'],
    ['barScale'],
    ['getShotMarkerCategory'],
    ['formatBandLabel'],
    ['combinedPuttResult'],
    ['decombinedPuttResult'],
    ['combinedBreakDirection'],
    ['decombinedBreakDirection'],
    ['legacySlopeToAxes'],
    ['buildInitialRows'],
    ['computeRoundSG'],
    ['calculateRoundSG'],
    ['calculateShotSG'],
    ['getExpectedStrokes'],
    ['getShotCategory'],
    ['inferShot'],
    ['haversineYards'],
    ['toRadians'],
    ['formatSG'],
    ['interpolateBaseline'],
    ['getHandicapBracket'],
    ['calculateHandicapIndex'],
  ])('exports %s as a function', (name) => {
    expect(typeof OgaCore[name]).toBe('function')
  })

  it('exports DEFAULT_BAG as a non-empty array', () => {
    expect(Array.isArray(OgaCore.DEFAULT_BAG)).toBe(true)
    expect(OgaCore.DEFAULT_BAG.length).toBeGreaterThan(0)
  })
})
