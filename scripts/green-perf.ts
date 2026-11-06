// Time one green through every core green function, as a phone would run it.
// Hermes has no JIT, so run it without one:
//   node --jitless --import tsx scripts/green-perf.ts
// Prints the median of 20 runs. A check to read, not a test: timings vary by machine.
import fixture from '../packages/core/src/green/__fixtures__/green-way-289147011.json'
import {
  decodeGreenGrid,
  encodeGreenGrid,
  falseFront,
  falseFrontWords,
  greenHachures,
  greenPlaneTilt,
  greenShape,
  greenSlopeField,
  shapePhrase,
  bothEndsWords,
  type GreenGrid,
} from '../packages/core/src/green'

const { width, height, stepMm, zMinMm, q } = fixture
const source: GreenGrid = {
  width,
  height,
  stepMm,
  zMinMm,
  mask: Uint8Array.from(q.flat(), (v) => (v === null ? 0 : 1)),
  heightsMm: Float64Array.from(q.flat(), (v) => (v === null ? NaN : zMinMm + stepMm * v)),
}
const bytes = encodeGreenGrid(source)

function once(): number {
  const t0 = performance.now()
  const g = decodeGreenGrid(bytes)
  const field = greenSlopeField(g)
  const tilt = greenPlaneTilt(g)
  greenHachures(g, field)
  const shape = greenShape(g)
  const ff = falseFront(g, field, 30)
  if (ff) falseFrontWords(ff, 'yards')
  if (tilt) bothEndsWords(tilt.downhillDeg, tilt.tiltPct, 30)
  if (shape) shapePhrase(shape, 30, 'yards')
  return performance.now() - t0
}

const times = Array.from({ length: 20 }, once).sort((a, b) => a - b)
const inside = source.mask.reduce((a, b) => a + b, 0)
console.log(`${inside} inside cells, ${bytes.length} B: median ${times[10]!.toFixed(1)} ms, max ${times[19]!.toFixed(1)} ms`)
