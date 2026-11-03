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

/** Rounds with strokes-gained data the player needs before generate-practice-plan
 *  asks Claude to write the plan. Below it the plan is built on the server with
 *  no AI call. Changing it needs an Edge Function deploy as well as an OTA. */
export const AI_PLAN_MIN_SG_ROUNDS = 5

/** Should the Generate button say Claude writes the plan (App Store 5.1.2(i))?
 *  True whenever pressing it can send data to Claude. While the round count is
 *  unknown (loading, or the count failed) it says so too: hiding it would let
 *  the press go out undisclosed. The function's caps can still turn the press
 *  into a plan built without AI; saying so then is harmless. */
export function generateMaySendToAi(roundsWithSG: number | null | undefined): boolean {
  return roundsWithSG == null || roundsWithSG >= AI_PLAN_MIN_SG_ROUNDS
}

/** Did Claude write this stored plan? generate-practice-plan records its
 *  outcome in `raw_model_output.status`: 'ok' or 'repaired' when Claude's draft
 *  was stored, 'baseline' or 'error' when the server built the plan without it.
 *  Plans from before that column (null) are not claimed. */
export function isAiWrittenPlan(rawModelOutput: unknown): boolean {
  if (!rawModelOutput || typeof rawModelOutput !== 'object') return false
  const status = (rawModelOutput as { status?: unknown }).status
  return status === 'ok' || status === 'repaired'
}
