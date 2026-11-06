import { describe, expect, it } from 'vitest'
import { byteaBytes } from './green-maps'

describe('byteaBytes', () => {
  it('reads PostgREST’s hex form of a bytea', () => {
    expect([...byteaBytes('\\x0102ff7A')]).toEqual([1, 2, 255, 122])
  })

  it.each([
    ['no \\x prefix', '0102'],
    ['an odd digit count', '\\x012'],
    ['a non-hex digit', '\\x01zz'],
  ])('throws on %s', (_, s) => {
    expect(() => byteaBytes(s)).toThrow()
  })

  it('refuses more than the column allows before allocating', () => {
    expect(() => byteaBytes(`\\x${'00'.repeat(16_385)}`)).toThrow(/16384/)
  })
})
