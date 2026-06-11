// The Anthropic tool-use call for plan generation (§3 step 7, §11). Single
// responsibility: forge ONE forced tool-call to the model and return the parsed
// draft + a forensic per-call record + the repair handles. The orchestrator
// (index.ts) decides whether to validate, repair, or fall back to baseline; this
// module never reaches the DB and never builds the baseline.
//
// No vitest here — this is Edge I/O. `buildMessages` is pulled out PURE + exported
// so the repair-shape (the easy API-400) is inspectable/asserted at Task 9 without
// a live call. Everything else is correct-by-inspection against the Anthropic SDK
// contracts (error classes, tool_use→tool_result, request_id, model-id validity).
import Anthropic from 'npm:@anthropic-ai/sdk'
import type { PlanDraft } from '../_shared/practice-plan/types.ts'

// Anthropic content-block / message param types. The SDK ships them under the
// `Anthropic.Messages` namespace; alias here so the signatures read cleanly.
type ContentBlock = Anthropic.Messages.ContentBlock
type MessageParam = Anthropic.Messages.MessageParam

/** Per-call timeout. The SDK's `timeout` is a TRUE total-request budget (it bounds
 *  call + the one retry, unlike a per-chunk HTTP read timeout). 30s leaves room for
 *  the first call + a repair turn to both land inside the Edge wall-clock limit
 *  (Supabase free-tier ~150s, but the orchestrator also re-checks elapsed budget
 *  before repairing). Deliberately NOT wrapped in an outer AbortController/
 *  Promise.race — that can abort mid-SDK-retry and stacks latency. */
const REQUEST_TIMEOUT_MS = 30_000

/** ≈3× the ~1.45K estimated output (§22) for headroom — the candidate-driven
 *  tool-call JSON grows with session/block count; sizing at the bare estimate
 *  risks `stop_reason: 'max_tokens'` and an unparsable partial. */
const MAX_TOKENS = 4096

/** Model families whose sampling params (temperature/top_p/top_k) are REMOVED —
 *  sending `temperature` 400s. Sonnet 4.6 / Haiku 4.5 accept it; Opus-4.7-class
 *  does not. `PLAN_MODEL` is an open env knob, so gate `temperature` on the id. */
function modelRejectsSamplingParams(model: string): boolean {
  // Opus 4.7 and later strip sampling params. Conservative substring match: any
  // opus-4-7+ id. (If a future Sonnet/Haiku also strips them, extend here.)
  return /opus-4-(7|8|9)/.test(model) || /opus-[5-9]/.test(model)
}

/** Truncation: the forced tool-call JSON came back partial (`stop_reason ===
 *  'max_tokens'`) and is unparsable. A repair turn can't shorten it, so the
 *  orchestrator must go STRAIGHT to baseline. Distinct class so it's caught
 *  ahead of the generic SDK errors. */
export class PlanTruncatedError extends Error {
  readonly request_id: string | null
  readonly model: string
  constructor(model: string, request_id: string | null) {
    super('Claude response truncated at max_tokens; forced tool-call JSON is partial')
    this.name = 'PlanTruncatedError'
    this.model = model
    this.request_id = request_id
  }
}

/** The forced tool ran but emitted no parseable `tool_use` block (e.g. the model
 *  returned only text, or tool_choice was somehow not honored). Maps to baseline. */
export class PlanToolUseMissingError extends Error {
  readonly request_id: string | null
  readonly model: string
  constructor(model: string, request_id: string | null) {
    super('Claude response contained no tool_use block for the forced tool')
    this.name = 'PlanToolUseMissingError'
    this.model = model
    this.request_id = request_id
  }
}

/** What the orchestrator passes to fire the single repair turn. `priorAssistantContent`
 *  is the FULL assistant `content` array from the first attempt, verbatim (it carries
 *  the unanswered `tool_use` block); `toolUseId` is that block's id. */
export interface RepairContext {
  priorAssistantContent: ContentBlock[]
  toolUseId: string
  errors: string[]
}

export interface GeneratePlanDraftArgs {
  system: string
  user: string
  /** The tool definition (PLAN_TOOL). Generic over the tool — forwarded as-is. */
  tool: { name: string; [k: string]: unknown }
  model: string
  sessionCount: number
  repair?: RepairContext
}

/** One per-call forensic record. The ORCHESTRATOR assembles the multi-attempt
 *  discriminated `raw_model_output` envelope across attempts (status 'ok' on a
 *  clean first call, 'repaired' when it stitches a first + second attempt, etc.);
 *  THIS module returns only the single-call piece so the orchestrator can append
 *  it to the `attempts` array. Keeping assembly in one place avoids two modules
 *  disagreeing on the envelope shape. */
export interface CallAttempt {
  stop_reason: string | null
  request_id: string | null
  usage: { input_tokens: number; output_tokens: number } | null
}

export interface GeneratePlanDraftResult {
  /** The forced tool call's `input`, cast to PlanDraft (validated downstream by
   *  validatePlanDraft — this is the untrusted model output, not yet trusted). */
  draft: PlanDraft
  /** Resolved model id (env-driven) — lets the §16 eval-gate audit per stored plan. */
  model: string
  /** The first-attempt tool_use block id (so the orchestrator can build a repair). */
  toolUseId: string
  /** The full assistant `content` array (carries the unanswered tool_use block,
   *  required verbatim for the repair turn's contract). */
  assistantContent: ContentBlock[]
  /** This single call's forensic record (orchestrator folds into `attempts`). */
  attempt: CallAttempt
}

/**
 * PURE message-array builder. Exported so the repair contract — the easy API-400
 * — is inspectable/asserted without a live call (Task 9).
 *
 * First attempt: a single user turn.
 * Repair attempt: user prompt → the prior assistant turn (with its `tool_use`) →
 * a user turn whose ONLY block is a `tool_result` matching `tool_use_id`. A
 * `tool_use` MUST be answered by a `tool_result` before the next turn; appending
 * the prior tool-call + a plain user *text* message would 400. The constraint
 * restatement rides INSIDE the `tool_result.content`.
 */
export function buildMessages(
  userPrompt: string,
  sessionCount: number,
  repair?: RepairContext,
): MessageParam[] {
  if (!repair) {
    return [{ role: 'user', content: userPrompt }]
  }
  const guidance =
    `Validation failed: ${repair.errors.join('; ')}. Re-emit the tool call, corrected. ` +
    `Reference drills only by the 0-based number shown; emit no target numbers; ` +
    `build exactly ${sessionCount} sessions; cover the top-2 focus areas.`
  return [
    { role: 'user', content: userPrompt },
    { role: 'assistant', content: repair.priorAssistantContent },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: repair.toolUseId,
          is_error: true,
          content: guidance,
        },
      ],
    },
  ]
}

/**
 * Fire ONE forced tool-call. Throws on truncation / missing-tool-use / SDK errors
 * (caught + mapped to baseline by the orchestrator). Returns the parsed draft +
 * repair handles + a per-call forensic record on success.
 *
 * The caller (index.ts) catches the SDK's typed exception classes, most-specific-
 * first, and maps them to the baseline fallback with the right LOUDness:
 *   AuthenticationError / PermissionDeniedError → baseline + a LOUD distinct alert
 *       (bad/missing ANTHROPIC_API_KEY would otherwise silently baseline EVERY user)
 *   RateLimitError / OverloadedError            → baseline; do NOT burn the cap
 *   BadRequestError / PlanTruncatedError /
 *       PlanToolUseMissingError                  → baseline + console.error(request_id)
 * This module surfaces those classes unchanged so the orchestrator can branch on
 * them; it only translates the two protocol failures (truncation, no-tool-use)
 * into the typed errors above.
 */
export async function generatePlanDraft(
  args: GeneratePlanDraftArgs,
): Promise<GeneratePlanDraftResult> {
  const { system, user, tool, model, sessionCount, repair } = args

  // maxRetries: 1 (not the default 2) — the SDK retries 429/500/529 with backoff,
  // and one retry bounds total wall-clock against the Edge limit. `timeout` is the
  // SDK's true total-request budget; no outer AbortController (see REQUEST_TIMEOUT_MS).
  const client = new Anthropic({ maxRetries: 1, timeout: REQUEST_TIMEOUT_MS })

  // NB: do NOT add `cache_control` to `system` — at ~1.75K it's below Sonnet's
  // 2048-token cache floor (§11), so it would pay the 1.25× write for zero reads.
  // `system` is byte-identical between the first call and the repair (the SDK
  // sees the same string; only `messages` differs) so a future cache could hit.
  const body: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: MAX_TOKENS,
    system,
    // Forced single tool — the model can only answer by calling it.
    tools: [tool as Anthropic.Messages.Tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: buildMessages(user, sessionCount, repair),
  }

  // temperature: 0 for determinism on Sonnet 4.6 / Haiku 4.5; OMITTED on Opus-4.7-
  // class (sampling params removed there → 400). Determinism on those is via prompt.
  if (!modelRejectsSamplingParams(model)) {
    body.temperature = 0
  }

  const response = await client.messages.create(body)

  const request_id = response._request_id ?? null
  const attempt: CallAttempt = {
    stop_reason: response.stop_reason,
    request_id,
    usage: response.usage
      ? { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }
      : null,
  }

  // Check truncation FIRST — a max_tokens stop means the tool-call JSON is partial
  // and unparsable. Distinct error; the orchestrator skips repair → straight to baseline.
  if (response.stop_reason === 'max_tokens') {
    throw new PlanTruncatedError(model, request_id)
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === 'tool_use' && block.name === tool.name,
  )
  if (!toolUse) {
    throw new PlanToolUseMissingError(model, request_id)
  }

  return {
    // `input` is the model's untrusted output — cast to PlanDraft; validatePlanDraft
    // (orchestrator) is what makes it trustworthy.
    draft: toolUse.input as PlanDraft,
    model,
    toolUseId: toolUse.id,
    assistantContent: response.content,
    attempt,
  }
}
