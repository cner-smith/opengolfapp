// Inaugural Edge Function. Two modes:
//   - manual:  POST { "roundId": "<uuid>" }  → send that round's summary (dev tool;
//              always sends, even if already sent — for prove-the-pipe testing).
//   - cron:    POST {} (no roundId)          → scan completed rounds not yet emailed,
//              respect the opt-in, send, then stamp summary_email_sent_at.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4'
import { resolveCourseTee, scoredHolePars } from '../_shared/hole-tees.ts'
import { buildRoundSummary, roundSummaryPar } from '../_shared/round-summary.ts'
import { renderHtml } from './template.ts'

const FROM = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev'

interface RoundRow {
  id: string
  user_id: string
  total_score: number | null
  hole_count: number | null
  course_tee_id: string | null
  tee_color: string | null
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  courses: { name: string | null; course_tees: { id: string; tee_color: string; par: number | null }[] } | null
  hole_scores:
    | {
        score: number | null
        par: number | null
        holes: { par: number; hole_tees: { course_tee_id: string; par: number | null }[] } | null
      }[]
    | null
}

const ROUND_SELECT = `
  id, user_id, total_score, hole_count, course_tee_id, tee_color,
  sg_off_tee, sg_approach, sg_around_green, sg_putting,
  courses(name, course_tees(id, tee_color, par)),
  hole_scores(score, par, holes(par, hole_tees(course_tee_id, par)))
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

    // Par of the holes the round scored, as played (per-round override, else
    // the played tee's, else the hole's; #1462), so a 6-hole round reads
    // against its own six holes (#727). With none, the tee's par scaled to the
    // round's hole count, else 4 a hole, else the tee's par, else 72 — see
    // roundSummaryPar.
    const tee = resolveCourseTee(round.courses?.course_tees ?? [], round.course_tee_id, round.tee_color)
    const scoredPars = scoredHolePars(round.hole_scores ?? [], tee?.id)
    const par = roundSummaryPar(scoredPars, tee?.par, round.hole_count)
    const content = buildRoundSummary({
      courseName: round.courses?.name ?? 'your round',
      totalScore: round.total_score ?? 0,
      par,
      // null = no valued shot in that category: its bar is left out (#1450).
      sg: {
        offTee: round.sg_off_tee,
        approach: round.sg_approach,
        aroundGreen: round.sg_around_green,
        putting: round.sg_putting,
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
