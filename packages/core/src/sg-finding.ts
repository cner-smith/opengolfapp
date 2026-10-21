// The one-line finding over a player's strokes gained by category, as Home,
// Stats and Practice lead with it.

/** One SG category's per-round average, with its display label ("Approach"). */
export interface SGFindingArea {
  label: string
  value: number
}

/**
 * "Approach costs you 1.3 strokes a round; off the tee gains you 0.7." The
 * strength is named when it is a different category gaining 0.05 or more.
 * When nothing costs, the two screens speak differently:
 * - 'every part' (Home): a weakest above −0.05 (one that rounds to 0.0, #911)
 *   reads "Every part of your game is gaining strokes; putting leads at 0.9 a
 *   round."
 * - 'softest area' (Stats): a weakest within ±0.05 (it rounds to 0.0, #1185)
 *   reads "Approach is your softest area, about even"; from +0.05 it is "still
 *   gaining 0.2 a round"; from −0.05 it costs. Then the strength.
 */
export function sgFinding(
  weakest: SGFindingArea,
  strongest: SGFindingArea | null,
  noLeak: 'every part' | 'softest area',
): string {
  if (noLeak === 'every part' && weakest.value > -0.05) {
    const lead = strongest ?? weakest
    return `Every part of your game is gaining strokes; ${lead.label.toLowerCase()} leads at ${lead.value.toFixed(1)} a round.`
  }
  const opening =
    weakest.value <= -0.05
      ? `${weakest.label} costs you ${Math.abs(weakest.value).toFixed(1)} strokes a round`
      : weakest.value < 0.05
        ? `${weakest.label} is your softest area, about even`
        : `${weakest.label} is your softest area, still gaining ${weakest.value.toFixed(1)} a round`
  return strongest && strongest.label !== weakest.label && strongest.value >= 0.05
    ? `${opening}; ${strongest.label.toLowerCase()} gains you ${strongest.value.toFixed(1)}.`
    : `${opening}.`
}
