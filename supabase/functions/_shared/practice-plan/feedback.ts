/** Sanitize the player's untrusted plan feedback (D14). Layered so it can never
 *  break out of the prompt delimiter (§9 layer 3):
 *   1. strip C0 control chars + DEL + C1 control chars (explicit \x escapes),
 *   2. strip angle brackets so it can't forge a `</player_feedback>` close-tag
 *      (the randomized delimiter id in buildPlanPrompt is the second layer),
 *   3. collapse all whitespace/newlines to single spaces, trim,
 *   4. length-cap at 500. Returns null when there's nothing usable. */
export function sanitizeFeedback(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw
    // eslint-disable-next-line no-control-regex -- intentionally stripping C0 + DEL + C1 from untrusted input
    .replace(/[\x00-\x1F\x7F-\x9F]+/g, ' ')
    .replace(/[<>]/g, ' ')        // forge-proof: no angle brackets reach the prompt
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  return cleaned.slice(0, 500)
}
