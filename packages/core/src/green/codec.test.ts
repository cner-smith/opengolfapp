import { describe, expect, it } from 'vitest'
import { decodeGreenGrid, encodeGreenGrid, type GreenGrid } from './codec'
import fixture from './__fixtures__/green-way-289147011.json'

const hex = (s: string) => Uint8Array.from(s.split(' ').map((b) => parseInt(b, 16)))

// The research doc's worked vector: W 3, H 2, zmin 361,250 mm, k 0,
// mask 0 1 1 / 1 1 1, Q – 1 1 / 0 1 3, residuals 1 0 0 0 2.
const VECTOR = '01 02 03 00 02 00 22 83 05 00 00 01 05 c3 c0'

function fixtureGrid(): GreenGrid {
  const { width, height, stepMm, zMinMm, q } = fixture
  const mask = new Uint8Array(width * height)
  const heightsMm = new Float64Array(width * height).fill(NaN)
  q.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === null) return
      mask[r * width + c] = 1
      heightsMm[r * width + c] = zMinMm + stepMm * v
    }),
  )
  return { width, height, stepMm, zMinMm, mask, heightsMm }
}

describe('decodeGreenGrid', () => {
  it('decodes the hand-checked 3×2 vector', () => {
    const g = decodeGreenGrid(hex(VECTOR))
    expect(g.width).toBe(3)
    expect(g.height).toBe(2)
    expect(g.stepMm).toBe(2)
    expect(g.zMinMm).toBe(361_250)
    expect([...g.mask]).toEqual([0, 1, 1, 1, 1, 1])
    expect([...g.heightsMm]).toEqual([NaN, 361_252, 361_252, 361_250, 361_252, 361_256])
  })

  it('reads an escaped residual: 16 one-bits, a zero, then v as 16 raw bits', () => {
    // W 1, H 1, zmin 0, k 0, mask runs 0 out / 1 in. r = 20 → v = 40, q = 40 ≥ 16.
    const g = decodeGreenGrid(hex('01 02 01 00 01 00 00 00 00 00 00 00 01 ff ff 00 14 00'))
    expect([...g.heightsMm]).toEqual([40])
  })

  it('reads a k = 4 code: q = 40 >> 4 = 2 → 110, then the low 4 bits 1000', () => {
    const g = decodeGreenGrid(hex('01 02 01 00 01 00 00 00 00 00 04 00 01 d0'))
    expect([...g.heightsMm]).toEqual([40])
  })

  it.each([
    ['empty input', ''],
    ['a truncated header', '01 02 03 00 02 00 22 83 05 00'],
    ['an unknown version', '02 02 03 00 02 00 22 83 05 00 00 01 05 c3 c0'],
    ['a zero step', '01 00 03 00 02 00 22 83 05 00 00 01 05 c3 c0'],
    ['a zero width', '01 02 00 00 02 00 22 83 05 00 00 01 05 c3 c0'],
    ['a Rice k over 15', '01 02 03 00 02 00 22 83 05 00 10 01 05 c3 c0'],
    ['mask runs that overrun the grid', '01 02 03 00 02 00 22 83 05 00 00 01 09 c3 c0'],
    ['an unterminated mask varint', '01 02 03 00 02 00 22 83 05 00 00 81 81'],
    ['mask runs that stop short of the grid', '01 02 03 00 02 00 22 83 05 00 00 01'],
    ['residual bits that run out', '01 02 03 00 02 00 22 83 05 00 00 01 05 c3'],
    ['an escape cut short', '01 02 01 00 01 00 00 00 00 00 00 00 01 ff ff 00'],
    ['trailing bytes', '01 02 03 00 02 00 22 83 05 00 00 01 05 c3 c0 00'],
    ['non-zero padding', '01 02 03 00 02 00 22 83 05 00 00 01 05 c3 c1'],
  ])('rejects %s', (_, bytes) => {
    expect(() => decodeGreenGrid(bytes ? hex(bytes) : new Uint8Array())).toThrow(/green grid/)
  })

  it('rejects random garbage without hanging or reading past the end', () => {
    let seed = 7
    const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648
    for (let t = 0; t < 300; t++) {
      const b = Uint8Array.from({ length: 11 + Math.floor(rand() * 40) }, () => Math.floor(rand() * 256))
      b[0] = 1
      b[1] = 2
      try {
        decodeGreenGrid(b)
      } catch (e) {
        expect(String(e)).toMatch(/green grid/)
      }
    }
  })
})

describe('encodeGreenGrid', () => {
  it('encodes the 3×2 vector to the research bytes', () => {
    expect(encodeGreenGrid(decodeGreenGrid(hex(VECTOR)))).toEqual(hex(VECTOR))
  })

  it('picks the k that makes the shortest code', () => {
    // r = 20 (v = 40): k 0 needs a 33-bit escape; k 4, 5 and 6 need 7 bits. The smallest such k wins.
    const g: GreenGrid = { width: 1, height: 1, stepMm: 2, zMinMm: 0, mask: Uint8Array.of(1), heightsMm: Float64Array.of(40) }
    expect(encodeGreenGrid(g)).toEqual(hex('01 02 01 00 01 00 00 00 00 00 04 00 01 d0'))
  })

  it('round-trips a real Oklahoma green bit-exactly, in about the research size', () => {
    const g = fixtureGrid()
    const bytes = encodeGreenGrid(g)
    const back = decodeGreenGrid(bytes)
    expect(back.width).toBe(72)
    expect(back.height).toBe(50)
    expect(back.zMinMm).toBe(fixture.zMinMm)
    expect([...back.mask]).toEqual([...g.mask])
    expect([...back.heightsMm]).toEqual([...g.heightsMm])
    expect(back.mask.reduce((a, b) => a + b, 0)).toBe(2005)
    expect(bytes.length).toBeLessThan(1200)
  })

  it('refuses a residual too big for the escape', () => {
    const g: GreenGrid = { width: 1, height: 1, stepMm: 1, zMinMm: 0, mask: Uint8Array.of(1), heightsMm: Float64Array.of(40_000) }
    expect(() => encodeGreenGrid(g)).toThrow(/green grid/)
  })
})
