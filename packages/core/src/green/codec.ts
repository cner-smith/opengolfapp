// Green height grid, byte format v1 (#1372 research, #1378).
//
// Little-endian header (11 bytes): u8 version = 1, u8 step_mm, u16 W, u16 H,
// i32 zmin_mm, u8 k (Rice parameter, 0–15). Then the mask as LEB128 run
// lengths over the W·H cells, alternating outside / inside and starting with
// an outside run (which may be 0). Then one Rice code per inside cell,
// MSB-first, row-major, zero-padded to the byte.
//
// Cells are 0.5 m, row 0 = north, column 0 = west. Q (height in steps above
// zmin) is predicted from its west, north and north-west neighbours
// (a + b − c, outside cells included); an inside cell stores the residual,
// an outside cell takes the prediction and stores nothing.
//
// Residual code: v = zigzag(r), q = v >> k. q < 16: q one-bits, a zero, the
// low k bits of v. Otherwise: 16 one-bits, a zero, v as 16 raw bits.

/** Side of one grid cell, in metres. */
export const GREEN_CELL_M = 0.5

export interface GreenGrid {
  width: number
  height: number
  /** Height quantum, mm. */
  stepMm: number
  /** Height of step 0, mm. */
  zMinMm: number
  /** 1 = inside the green outline, row-major. */
  mask: Uint8Array
  /** Height in mm above the datum, NaN outside the outline, row-major. */
  heightsMm: Float64Array
}

const HEADER = 11
const ESCAPE_Q = 16
const MAX_CELLS = 1 << 20

function fail(why: string): never {
  throw new Error(`Invalid green grid: ${why}`)
}

function predict(Q: Int32Array, W: number, r: number, c: number): number {
  const j = r * W + c
  if (r && c) return Q[j - 1]! + Q[j - W]! - Q[j - W - 1]!
  if (c) return Q[j - 1]!
  if (r) return Q[j - W]!
  return 0
}

export function decodeGreenGrid(b: Uint8Array): GreenGrid {
  if (b.length < HEADER) fail(`${b.length} bytes is shorter than the header`)
  if (b[0] !== 1) fail(`unknown version ${b[0]}`)
  const stepMm = b[1]!
  const W = b[2]! | (b[3]! << 8)
  const H = b[4]! | (b[5]! << 8)
  const zMinMm = b[6]! | (b[7]! << 8) | (b[8]! << 16) | (b[9]! << 24)
  const k = b[10]!
  if (stepMm === 0) fail('step is 0')
  if (W === 0 || H === 0) fail(`empty grid ${W}×${H}`)
  if (k > 15) fail(`Rice k ${k} is over 15`)

  const n = W * H
  // Checked before allocating: a garbage header can claim 65535×65535 cells (~55 GB of arrays).
  // A green is ~2,000 cells; this cap is a 512 m square at 0.5 m.
  if (n > MAX_CELLS) fail(`${W}×${H} is over ${MAX_CELLS} cells`)
  const mask = new Uint8Array(n)
  let pos = HEADER
  let inside = false
  for (let i = 0; i < n; ) {
    let v = 0
    let scale = 1
    for (let len = 0; ; len++) {
      if (pos >= b.length) fail('the mask runs past the end')
      if (len === 5) fail('a mask run is over 5 bytes')
      const x = b[pos++]!
      v += (x & 127) * scale
      scale *= 128
      if (!(x & 128)) break
    }
    if (i + v > n) fail('the mask runs overrun the grid')
    if (inside) mask.fill(1, i, i + v)
    i += v
    inside = !inside
  }

  const end = b.length * 8
  let bit = pos * 8
  const get = () => {
    if (bit >= end) fail('the residuals run past the end')
    const v = (b[bit >> 3]! >> (7 - (bit & 7))) & 1
    bit++
    return v
  }

  const Q = new Int32Array(n)
  const heightsMm = new Float64Array(n)
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const j = r * W + c
      const p = predict(Q, W, r, c)
      if (!mask[j]) {
        Q[j] = p
        heightsMm[j] = NaN
        continue
      }
      let q = 0
      while (q < ESCAPE_Q && get()) q++
      let v = 0
      if (q === ESCAPE_Q) {
        if (get()) fail('an escape is missing its zero bit')
        for (let t = 0; t < 16; t++) v = (v << 1) | get()
      } else {
        v = q << k
        for (let t = k - 1; t >= 0; t--) v |= get() << t
      }
      Q[j] = p + ((v >>> 1) ^ -(v & 1))
      heightsMm[j] = zMinMm + stepMm * Q[j]!
    }
  }

  const used = Math.ceil(bit / 8)
  if (used !== b.length) fail(`${b.length - used} trailing bytes`)
  if (bit & 7 && b[used - 1]! & (0xff >> (bit & 7))) fail('the padding bits are not zero')
  return { width: W, height: H, stepMm, zMinMm, mask, heightsMm }
}

function riceBits(v: number, k: number): number {
  const q = v >> k
  return q < ESCAPE_Q ? q + 1 + k : ESCAPE_Q + 1 + 16
}

/** The offline pipeline's encoder. Heights are rounded to the grid's step. */
export function encodeGreenGrid(g: GreenGrid): Uint8Array {
  const { width: W, height: H, stepMm, zMinMm, mask, heightsMm } = g
  const n = W * H
  if (W < 1 || H < 1 || W > 0xffff || H > 0xffff) fail(`grid size ${W}×${H}`)
  if (stepMm < 1 || stepMm > 255 || !Number.isInteger(stepMm)) fail(`step ${stepMm}`)
  if (!Number.isInteger(zMinMm) || zMinMm < -(2 ** 31) || zMinMm >= 2 ** 31) fail(`zmin ${zMinMm}`)

  const Q = new Int32Array(n)
  const vs: number[] = []
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const j = r * W + c
      const p = predict(Q, W, r, c)
      if (!mask[j]) {
        Q[j] = p
        continue
      }
      const h = heightsMm[j]!
      if (!Number.isFinite(h)) fail(`inside cell ${j} has no height`)
      Q[j] = Math.round((h - zMinMm) / stepMm)
      const res = Q[j]! - p
      if (res <= -32_768 || res >= 32_768) fail(`residual ${res} is too big for the escape`)
      vs.push(res >= 0 ? res * 2 : -res * 2 - 1)
    }
  }

  let k = 0
  let best = Infinity
  for (let kk = 0; kk <= 15; kk++) {
    let bits = 0
    for (const v of vs) bits += riceBits(v, kk)
    if (bits < best) {
      best = bits
      k = kk
    }
  }

  const runs: number[] = []
  let state = 0
  let run = 0
  for (let j = 0; j < n; j++) {
    const m = mask[j] ? 1 : 0
    if (m !== state) {
      runs.push(run)
      run = 0
      state = m
    }
    run++
  }
  runs.push(run)

  const out: number[] = [1, stepMm, W & 255, W >> 8, H & 255, H >> 8]
  for (let s = 0; s < 32; s += 8) out.push((zMinMm >> s) & 255)
  out.push(k)
  for (let v of runs) {
    do {
      const x = v % 128
      v = Math.floor(v / 128)
      out.push(v ? x | 128 : x)
    } while (v)
  }

  let acc = 0
  let nbits = 0
  const put = (bitv: number) => {
    acc = (acc << 1) | bitv
    if (++nbits < 8) return
    out.push(acc)
    acc = 0
    nbits = 0
  }
  for (const v of vs) {
    const q = v >> k
    if (q < ESCAPE_Q) {
      for (let t = 0; t < q; t++) put(1)
      put(0)
      for (let t = k - 1; t >= 0; t--) put((v >> t) & 1)
    } else {
      for (let t = 0; t < ESCAPE_Q; t++) put(1)
      put(0)
      for (let t = 15; t >= 0; t--) put((v >> t) & 1)
    }
  }
  if (nbits) out.push(acc << (8 - nbits))
  return Uint8Array.from(out)
}
