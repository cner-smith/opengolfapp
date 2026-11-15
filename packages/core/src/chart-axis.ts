// Symmetric, "nice"-rounded Y-axis bounds + tick values for a zero-centered
// series (e.g. an SG trend, which swings +/- around 0). Auto-scales to the
// data's peak magnitude so the axis labels always match the plotted range — a
// fixed tick set (e.g. hardcoded [-1.5..1.5]) gets crammed into the middle the
// moment an outlier round blows out the auto-domain, and stops matching the
// lines. `floor` keeps a sensible minimum range for flat/empty data.
export function symmetricNiceTicks(
  values: number[],
  floor = 0.5,
): { max: number; ticks: number[] } {
  const peak = Math.max(floor, ...values.map((v) => Math.abs(v)))
  // Target ~3 ticks per side; round the step UP to a 1/2/2.5/5 × 10^n value so
  // labels land on readable numbers.
  const rawStep = peak / 3
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)))
  // rawStep/pow lands in [1, 10); pick the first nice multiple ≥ it, falling
  // back to 10×pow for the (5, 10) range (so the ?? branch is live, not dead).
  const step =
    [1, 2, 2.5, 5].map((m) => m * pow).find((c) => c >= rawStep) ?? 10 * pow
  const max = Math.ceil(peak / step) * step
  const ticks: number[] = []
  for (let t = -max; t <= max + step / 1000; t += step) {
    // step is often fractional (0.5, 0.2) — clean float drift to 2dp.
    ticks.push(Number(t.toFixed(2)))
  }
  return { max, ticks }
}

/** A padded axis on round numbers for a series that doesn't sit round zero:
 *  steps of 5, 10, 20, 50 or 100 (at most five ticks below 100), at least
 *  `minSpan` tall and never zero tall. */
export function niceAxis(values: number[], minSpan: number): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = [5, 10, 20, 50, 100].find((s) => Math.max(max - min, minSpan) / s <= 4) ?? 100
  const lo = Math.floor(min / step) * step
  let hi = Math.ceil(max / step) * step
  if (hi - lo < minSpan) hi = lo + Math.ceil(minSpan / step) * step
  if (hi === lo) hi = lo + step
  return { lo, hi, ticks: Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step) }
}
