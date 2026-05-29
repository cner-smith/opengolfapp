// Inaugural Edge Function. Two modes:
//   - manual:  POST { "roundId": "<uuid>" }  → send that round's summary (dev tool;
//              always sends, even if already sent — for prove-the-pipe testing).
//   - cron:    POST {} (no roundId)          → scan completed rounds not yet emailed,
//              respect the opt-in, send, then stamp summary_email_sent_at.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4'
import { buildRoundSummary } from '../_shared/round-summary.ts'
import { renderHtml } from './template.ts'

const FROM = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev'

interface RoundRow {
  id: string
  user_id: string
  total_score: number | null
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  courses: { name: string | null } | null
  course_tees: { par: number | null } | null
}

const ROUND_SELECT = `
  id, user_id, total_score,
  sg_off_tee, sg_approach, sg_around_green, sg_putting,
  courses(name),
  course_tees(par)
`

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// True only if the bearer is a service_role JWT. The gateway (verify_jwt on)
// has already validated the signature, so trusting the decoded `role` claim is
// sound — and unlike comparing the raw key string, it survives key rotation and
// the new API-key format.
function isServiceRole(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const payload = token.split('.')[1]
  if (!payload) return false
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    return JSON.parse(atob(padded)).role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  // Service-role-only — see isServiceRole. Blocks a regular user's access token
  // (role=authenticated) from triggering a cron-mode mass send or emailing the
  // owner of an arbitrary round id. The cron passes a service_role JWT via pg_net.
  if (!isServiceRole(req)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)

  let roundId: string | undefined
  try {
    const body = await req.json()
    roundId = body?.roundId
  } catch {
    // No JSON body → cron scan mode.
  }

  let query = supabase.from('rounds').select(ROUND_SELECT)
  query = roundId
    ? query.eq('id', roundId)
    : query
        .not('completed_at', 'is', null)
        .is('summary_email_sent_at', null)
        .not('total_score', 'is', null) // skip completed-but-empty rounds

  const { data: rounds, error } = await query.returns<RoundRow[]>()
  if (error) {
    console.error('[round-summary-email] query failed', error)
    return json({ error: 'query failed' }, 500)
  }

  // Low-volume scaffold: sequential per-round profile + auth lookups are fine.
  // Batch them if cron candidates ever exceed ~50 per run.
  let sent = 0
  for (const round of rounds ?? []) {
    // Skip completed-but-empty rounds — manual mode bypasses the cron's
    // total_score filter, so guard here too (avoids "0 (-72 to par)" emails).
    if (round.total_score == null) continue
    // Opt-in gate (respected in both modes).
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_round_summaries_enabled')
      .eq('id', round.user_id)
      .single()
    if (profile?.email_round_summaries_enabled === false) continue

    // Recipient lives in auth.users, not profiles — service role only.
    const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(round.user_id)
    const email = userRes?.user?.email
    if (userErr || !email) continue

    // Par from the round's resolved tee (course_tees.par), which matches the
    // in-app dashboard's total for standard 18/9-hole courses and the common
    // synthetic-hole case; 72 fallback when no tee row is linked. NOT byte-
    // identical to the dashboard's padded-holes derivation for partial-real-
    // hole rounds with a null tee par — accepted scaffold approximation.
    const par = round.course_tees?.par ?? 72
    const content = buildRoundSummary({
      courseName: round.courses?.name ?? 'your round',
      totalScore: round.total_score ?? 0,
      par,
      sg: {
        offTee: round.sg_off_tee ?? 0,
        approach: round.sg_approach ?? 0,
        aroundGreen: round.sg_around_green ?? 0,
        putting: round.sg_putting ?? 0,
      },
    })

    const { error: sendErr } = await resend.emails.send({
      from: `OGA Reports <${FROM}>`,
      to: [email],
      subject: content.subject,
      html: renderHtml(content),
      headers: {
        'List-Unsubscribe': '<mailto:reports@oga.golf?subject=unsubscribe>',
      },
    })
    // On failure, leave summary_email_sent_at null so the next cron tick retries.
    if (sendErr) {
      console.error('[round-summary-email] resend send failed', round.id, sendErr)
      continue
    }

    const { error: stampErr } = await supabase
      .from('rounds')
      .update({ summary_email_sent_at: new Date().toISOString() })
      .eq('id', round.id)
    if (stampErr) {
      console.error('[round-summary-email] stamp failed', round.id, stampErr)
      continue
    }
    sent++
  }

  return json({ candidates: rounds?.length ?? 0, sent })
})
