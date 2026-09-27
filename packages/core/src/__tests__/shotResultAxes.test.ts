import { describe, expect, it } from 'vitest'
import { SHOT_CONTACTS, legacyShotResult, shotAxesFromLegacy } from '../index'

describe('legacyShotResult', () => {
  it('is null when nothing is set, or only a shape', () => {
    expect(legacyShotResult({})).toBeNull()
    expect(legacyShotResult({ shape: 'draw' })).toBeNull()
    expect(legacyShotResult({ startLine: 'on_line' })).toBeNull()
  })

  it('lets OB, then penalty, win over the axes', () => {
    expect(legacyShotResult({ contact: 'thin', ob: true, penalty: true })).toBe('ob')
    expect(legacyShotResult({ contact: 'thin', penalty: true })).toBe('penalty')
  })

  it('prefers a contact miss over a start-line miss', () => {
    expect(legacyShotResult({ contact: 'fat', startLine: 'push' })).toBe('fat')
    expect(legacyShotResult({ contact: 'thin', startLine: 'pull' })).toBe('thin')
    expect(legacyShotResult({ contact: 'solid', startLine: 'push' })).toBe('push_right')
    expect(legacyShotResult({ contact: 'solid', startLine: 'pull' })).toBe('pull_left')
    expect(legacyShotResult({ contact: 'solid', startLine: 'on_line', shape: 'fade' })).toBe('solid')
  })

  it('round-trips every legacy value the axes can hold', () => {
    for (const r of [...SHOT_CONTACTS, 'pull_left', 'push_right'] as const) {
      expect(legacyShotResult(shotAxesFromLegacy(r))).toBe(r)
    }
  })

  it('maps penalty / ob / unknown legacy values to empty axes', () => {
    for (const r of ['penalty', 'ob', null, undefined, 'bogus']) {
      expect(shotAxesFromLegacy(r)).toEqual({ contact: null, shape: null, startLine: null })
    }
  })
})
