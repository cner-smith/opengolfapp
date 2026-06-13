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
