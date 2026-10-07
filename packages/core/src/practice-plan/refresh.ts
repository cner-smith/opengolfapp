/** Should the Practice screen offer "Update your plan with your rounds"? (#1056)
 *
 *  True right after the player's 2nd or 3rd round with strokes-gained data, when
 *  the current plan was built on fewer rounds than that. Rounds are counted the
 *  way the generate-practice-plan Edge Function counts them (any `sg_*` column
 *  set), so the plan it writes records the same number in `based_on_rounds` and
 *  the prompt clears. Both counts sit under the function's 5-round threshold, so
 *  the update is always the free baseline plan, never a paid model call. The
 *  function runs this same rule to let the update replace a plan that is still
 *  inside its week. */
export function shouldPromptPlanRefresh(args: {
  planRounds: number | null
  roundsNow: number
}): boolean {
  const { planRounds, roundsNow } = args
  return (roundsNow === 2 || roundsNow === 3) && roundsNow > (planRounds ?? 0)
}
