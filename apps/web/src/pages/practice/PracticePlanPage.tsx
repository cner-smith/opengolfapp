import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  isPartialRound,
  normalizeCategoryProse,
  parseLocalDate,
  sgBreakdown,
  sgFinding,
  shouldPromptPlanRefresh,
  todayLocalDate,
} from '@oga/core'
import type { StoredBlock, StoredSession, StoredFocusArea } from '@oga/core'
import {
  useDrillsByIds,
  useGeneratePlan,
  useLatestPracticePlan,
  useRoundsWithSGCount,
  useSaveFeedback,
  useUpdatePlanProgress,
} from '../../hooks/useDrills'
import { useRecentSG } from '../../hooks/useRounds'
import { toUserMessage } from '../../lib/errors'
import {
  BLOCK_TYPE_LABEL,
  CATEGORY_LABEL,
  FACILITY_LABEL,
  ModeBar,
  ModeSwatch,
  planSessions,
  renderInstructions,
} from './drillDisplay'

// Resolved drill row from useDrillsByIds (shape mirrors getDrillsByIds' select).
type ResolvedDrill = {
  name: string
  description: string | null
  instructions: string | null
  facility: string[] | null
  source: string | null
  source_url: string | null
}

const LINE = '#D9D2BF'

// `valid_until` is a date string (YYYY-MM-DD) compared to today's local date,
// so a plan stays "current" through the whole of its final day.
function formatDate(value: string | null): string {
  if (!value) return ''
  const parsed = parseLocalDate(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function asFocusAreas(value: unknown): StoredFocusArea[] {
  return Array.isArray(value) ? (value as StoredFocusArea[]) : []
}

const SG_KEYS = [
  { key: 'sg_off_tee', label: 'Off the tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around the green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

// Home's strokes-gained finding over the same last 20 whole rounds: the plan
// exists because of that leak, so the leak leads. Null with no whole rounds.
function useFinding(): string | null {
  const sg = useRecentSG(20)
  return useMemo(() => {
    const whole = (sg.data ?? []).filter((r) => !isPartialRound(r.hole_scores, r.hole_count))
    if (whole.length === 0) return null
    const { breakdown } = sgBreakdown(whole)
    const sorted = SG_KEYS.map((c) => ({
      label: c.label,
      value: breakdown.find((b) => b.key === c.key)?.value ?? 0,
    })).sort((a, b) => b.value - a.value)
    return sgFinding(sorted[sorted.length - 1]!, sorted[0]!, 'every part')
  }, [sg.data])
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function GenerateButton({ label, onGenerate, isPending }: { label: string; onGenerate: () => void; isPending: boolean }) {
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={isPending}
      className="key key-primary"
      style={{
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {isPending ? (
        'Generating…'
      ) : (
        <>
          {label}{' '}
          <span className="font-serif" style={{ fontStyle: 'italic' }}>
            →
          </span>
        </>
      )}
    </button>
  )
}

/** Keyframes inlined so the progress bar stays local to this page. */
function GenerateProgressBar({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      aria-hidden="true"
      style={{ position: 'relative', height: 3, width: '100%', background: '#EBE5D6', overflow: 'hidden', borderRadius: 2 }}
    >
      <style>{`
        @keyframes oga-progress-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
      <div
        className="bg-caddie-accent"
        style={{ position: 'absolute', inset: 0, width: '25%', animation: 'oga-progress-slide 1.4s ease-in-out infinite' }}
      />
    </div>
  )
}

function Title({ sub }: { sub?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h1 className="font-serif text-caddie-ink" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}>
        Practice
      </h1>
      {sub ? (
        <div className="text-caddie-ink-dim" style={{ fontSize: 14, marginTop: 6 }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

function Finding({ text }: { text: string }) {
  return (
    <p
      className="font-serif text-caddie-ink"
      style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3, maxWidth: 680, marginBottom: 22 }}
    >
      {text}
    </p>
  )
}

function SideHead({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-serif text-caddie-ink"
      style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.2, marginBottom: 10 }}
    >
      {children}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div>
      <Title />
      <div style={{ height: 22, width: '60%', background: '#EBE5D6', marginBottom: 22 }} />
      <div style={{ height: 40, maxWidth: 680, background: '#EBE5D6', marginBottom: 28, borderRadius: 2 }} />
      {[0, 1].map((i) => (
        <div
          key={i}
          className="bg-caddie-surface"
          style={{ border: `1px solid ${LINE}`, borderRadius: 4, height: 220, marginBottom: 18, maxWidth: 680 }}
        />
      ))}
    </div>
  )
}

function NoPlanState({
  finding,
  onGenerate,
  isPending,
  errorNotice,
}: {
  finding: string | null
  onGenerate: () => void
  isPending: boolean
  errorNotice: React.ReactNode
}) {
  return (
    <div>
      <Title sub="No plan this week yet" />
      {finding ? <Finding text={finding} /> : null}
      <div
        className="bg-caddie-surface"
        style={{ border: `1px solid ${LINE}`, borderRadius: 4, padding: '28px 26px', maxWidth: 640, position: 'relative' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <GenerateProgressBar visible={isPending} />
        </div>
        <h2 className="font-serif text-caddie-ink" style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.2 }}>
          A week built from your own numbers.
        </h2>
        <p className="text-caddie-ink-dim" style={{ fontSize: 15, lineHeight: 1.55, marginTop: 10, maxWidth: 520 }}>
          Sessions sized to your strokes gained and the places you practice: which drills, in what order, and why
          each one is there.
        </p>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <GenerateButton label="Generate this week's plan" onGenerate={onGenerate} isPending={isPending} />
          <Link
            to="/practice/drills"
            className="text-caddie-ink-dim hover:text-caddie-ink underline underline-offset-4"
            style={{ fontSize: 14 }}
          >
            Browse all drills
          </Link>
        </div>
        {errorNotice}
      </div>
    </div>
  )
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div
      className="text-caddie-neg"
      role="alert"
      style={{
        marginTop: 18,
        marginBottom: 18,
        border: `1px solid ${LINE}`,
        borderRadius: 4,
        padding: '12px 14px',
        fontSize: 13,
        background: '#FBF8F1',
      }}
    >
      {toUserMessage(error)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The week bar: sessions done of planned and minutes done of planned. One
// segment per session, sized by its minutes, filled by the minutes ticked off.
// ---------------------------------------------------------------------------

function WeekBar({ sessions, completedIds }: { sessions: StoredSession[]; completedIds: Set<string> }) {
  const rows = sessions.map((s) => {
    const blocks = s.blocks ?? []
    const total = blocks.reduce((m, b) => m + b.minutes, 0)
    const done = blocks.filter((b) => completedIds.has(b.id)).reduce((m, b) => m + b.minutes, 0)
    return { title: s.title, total, done, complete: blocks.length > 0 && blocks.every((b) => completedIds.has(b.id)) }
  })
  if (rows.length === 0) return null
  const totalMin = rows.reduce((m, r) => m + r.total, 0)
  const doneMin = rows.reduce((m, r) => m + r.done, 0)
  const doneSessions = rows.filter((r) => r.complete).length
  return (
    <div style={{ maxWidth: 680, marginBottom: 30 }}>
      <div className="flex items-baseline justify-between" style={{ gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div className="text-caddie-ink" style={{ fontSize: 15 }} data-testid="week-sessions">
          <span className="font-serif tabular" style={{ fontSize: 22, fontWeight: 500 }}>
            {doneSessions}
          </span>{' '}
          of {rows.length} session{rows.length === 1 ? '' : 's'} done this week
        </div>
        <div className="text-caddie-ink-dim" style={{ fontSize: 13 }} data-testid="week-minutes">
          <span className="font-serif tabular text-caddie-ink" style={{ fontSize: 16 }}>
            {doneMin}
          </span>{' '}
          of {totalMin} min
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalMin}
        aria-valuenow={doneMin}
        aria-label="Minutes practised this week"
        style={{ display: 'flex', gap: 3, height: 12 }}
      >
        {rows.map((r, i) => (
          <div key={i} style={{ flex: r.total || 1, background: '#E4DCCA', borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
            <div
              className="prac-fill bg-caddie-accent"
              style={{ position: 'absolute', inset: 0, width: `${r.total ? (r.done / r.total) * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>
      {rows.length > 1 ? (
        <div className="text-caddie-ink-dim" style={{ display: 'flex', gap: 3, fontSize: 12, marginTop: 6 }}>
          {rows.map((r, i) => (
            <div
              key={i}
              className={r.complete ? 'text-caddie-ink' : undefined}
              style={{ flex: r.total || 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {r.title}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function TickBox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      // Re-keyed on change so the pop replays on every tick.
      key={String(checked)}
      className={checked ? 'prac-tick bg-caddie-accent text-caddie-accent-ink' : 'bg-caddie-surface'}
      style={{
        width: 22,
        height: 22,
        borderRadius: 2,
        border: checked ? '1px solid #1F3D2C' : '1px solid #9F9580',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        marginTop: 1,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {checked ? (
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
          <path
            className="prac-check"
            d="M2.5 6.2 5 8.7 9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  )
}

function DrillRow({
  block,
  drill,
  completed,
  onToggleComplete,
}: {
  block: StoredBlock
  drill: ResolvedDrill | undefined
  completed: boolean
  onToggleComplete: () => void
}) {
  const [open, setOpen] = useState(false)
  const drillName = drill?.name ?? 'Drill'
  const facilities = drill?.facility ?? []
  const instructions = drill?.instructions?.trim() || drill?.description?.trim() || ''
  const meta = [BLOCK_TYPE_LABEL[block.type] ?? block.type, ...facilities.map((f) => FACILITY_LABEL[f] ?? f)].join(' · ')
  const detailId = `drill-detail-${block.id}`

  return (
    <div style={{ borderTop: `1px solid ${LINE}`, padding: '14px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 14, alignItems: 'start' }}>
        <TickBox checked={completed} label={`Mark "${drillName}" done`} onToggle={onToggleComplete} />
        <div style={{ minWidth: 0 }}>
          <div
            className="font-serif"
            style={{
              fontSize: 18,
              fontStyle: 'italic',
              fontWeight: 500,
              lineHeight: 1.25,
              color: completed ? '#8A8B7E' : '#1C211C',
            }}
          >
            <span className="prac-strike" data-done={completed}>
              {drillName}
            </span>
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ModeSwatch type={block.type} />
            <span>
              {meta}
              {block.target != null ? ` · target ${block.target}` : ''}
            </span>
          </div>
        </div>
        <div
          className="font-serif tabular text-caddie-ink"
          style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.1, textAlign: 'right', whiteSpace: 'nowrap' }}
        >
          {block.minutes}
          <span className="font-sans text-caddie-ink-dim" style={{ fontSize: 13, marginLeft: 3 }}>
            min
          </span>
        </div>
      </div>
      <div style={{ marginLeft: 36, maxWidth: 580 }}>
        {block.rationale && !completed ? (
          <p className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6 }}>
            {block.rationale}
          </p>
        ) : null}
        {instructions ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={detailId}
            className="text-caddie-ink hover:opacity-80 underline underline-offset-4"
            style={{ fontSize: 13, marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            {open ? 'Hide how to run it' : 'How to run it'}
          </button>
        ) : null}
        {instructions && open ? (
          <div id={detailId} style={{ marginTop: 10, paddingLeft: 14, borderLeft: `2px solid ${LINE}` }}>
            {renderInstructions(instructions)}
            {drill?.source ? (
              <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 12 }}>
                From{' '}
                {drill.source_url ? (
                  <a href={drill.source_url} target="_blank" rel="noopener noreferrer" className="text-caddie-ink underline">
                    {drill.source}
                  </a>
                ) : (
                  drill.source
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SessionBlock({
  session,
  drillsById,
  completedIds,
  onToggleComplete,
}: {
  session: StoredSession
  drillsById: Record<string, ResolvedDrill>
  completedIds: Set<string>
  onToggleComplete: (blockId: string) => void
}) {
  const blocks = [...(session.blocks ?? [])].sort((a, b) => a.order - b.order)
  const doneCount = blocks.filter((b) => b.id != null && completedIds.has(b.id)).length
  const allDone = blocks.length > 0 && doneCount === blocks.length
  return (
    <section
      className="bg-caddie-surface"
      style={{
        border: `1px solid ${allDone ? '#1F3D2C' : LINE}`,
        borderRadius: 4,
        padding: '18px clamp(14px, 3vw, 20px) 6px',
        marginBottom: 18,
        transition: 'border-color 300ms ease',
      }}
    >
      <div className="flex items-baseline justify-between" style={{ gap: 12, marginBottom: 12 }}>
        <h2 className="font-serif text-caddie-ink" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>
          {session.title}
        </h2>
        <div
          className={allDone ? 'text-caddie-accent' : 'text-caddie-ink-dim'}
          style={{ fontSize: 13, whiteSpace: 'nowrap', fontWeight: allDone ? 600 : 400 }}
        >
          {allDone ? 'Done' : doneCount > 0 ? `${doneCount} of ${blocks.length} done` : `${session.total_minutes} min`}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <ModeBar parts={blocks} />
      </div>
      {blocks.map((block, i) => (
        <DrillRow
          key={block.id ?? `${block.drill_id}-${i}`}
          block={block}
          drill={block.drill_id ? drillsById[block.drill_id] : undefined}
          completed={block.id != null && completedIds.has(block.id)}
          onToggleComplete={() => {
            if (block.id != null) onToggleComplete(block.id)
          }}
        />
      ))}
    </section>
  )
}

// ---------------------------------------------------------------------------
// The side column: why this plan, what to work on, the note for next week.
// ---------------------------------------------------------------------------

function WhyThisPlan({ insight, note, basis }: { insight: string | null; note: string | null; basis: string }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <SideHead>Why this plan</SideHead>
      {insight ? (
        <p className="font-serif text-caddie-ink" style={{ fontSize: 17, lineHeight: 1.45, marginBottom: 10 }}>
          {insight}
        </p>
      ) : null}
      {note ? (
        <p className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.6 }}>
          {normalizeCategoryProse(note)}
        </p>
      ) : null}
      <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 10 }}>
        {basis}
      </div>
    </section>
  )
}

function FocusAreas({ areas }: { areas: StoredFocusArea[] }) {
  if (areas.length === 0) return null
  return (
    <section style={{ marginBottom: 28 }}>
      <SideHead>What to work on</SideHead>
      {areas.map((area, i) => (
        <div key={`${area.category}-${i}`} style={{ borderTop: `1px solid ${LINE}`, padding: '12px 0' }}>
          <div className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 600 }}>
            {CATEGORY_LABEL[area.category] ?? area.category}
          </div>
          <p className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 3 }}>
            {normalizeCategoryProse(area.reason)}
          </p>
          {area.article ? (
            <Link
              to={`/learn/${area.article.slug}`}
              className="text-caddie-ink underline underline-offset-4 hover:opacity-80"
              style={{ display: 'inline-block', marginTop: 6, fontSize: 13 }}
            >
              Read: {area.article.title}
            </Link>
          ) : null}
        </div>
      ))}
    </section>
  )
}

const FEEDBACK_MAX = 500

function FeedbackSection({ planId, initial }: { planId: string; initial: string }) {
  const saveFeedback = useSaveFeedback()
  const [value, setValue] = useState(initial)
  // The last persisted value: blur saves only real edits, and "Saved" clears
  // the moment the user edits again.
  const [savedValue, setSavedValue] = useState(initial)

  const handleBlur = () => {
    const next = value.trim()
    if (next === savedValue.trim()) return
    if (next.length === 0 && savedValue.trim().length === 0) return
    saveFeedback.mutate({ planId, feedback: next }, { onSuccess: () => setSavedValue(next) })
  }

  const showSaved = !saveFeedback.isPending && value.trim() === savedValue.trim() && savedValue.trim().length > 0

  return (
    <section style={{ marginBottom: 28 }}>
      <SideHead>Before next week</SideHead>
      <p className="text-caddie-ink-dim" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>
        One note on how the week went: what worked, what felt off. Next week's plan reads it.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        maxLength={FEEDBACK_MAX}
        rows={4}
        aria-label="Note for next week's plan"
        className="font-sans bg-caddie-surface text-caddie-ink"
        style={{
          width: '100%',
          border: `1px solid ${LINE}`,
          borderRadius: 2,
          padding: '10px 12px',
          fontSize: 14,
          lineHeight: 1.5,
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 12 }}>
        <span className={saveFeedback.isError ? 'text-caddie-neg' : 'text-caddie-ink-dim'}>
          {saveFeedback.isError ? "Couldn't save. Try again." : showSaved ? 'Saved' : ''}
        </span>
        <span className="text-caddie-ink-dim tabular">
          {value.length} / {FEEDBACK_MAX}
        </span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PracticePlanPage() {
  const planQuery = useLatestPracticePlan()
  const roundsWithSG = useRoundsWithSGCount()
  const generate = useGeneratePlan()
  const finding = useFinding()

  const plan = planQuery.data
  const sessions = planSessions(plan?.drills)
  const focusAreas = asFocusAreas(plan?.focus_areas)

  // Every block's drill UUID → row in one query.
  const drillIds = sessions.flatMap((s) => s.blocks.map((b) => b.drill_id).filter((id): id is string => id !== undefined))
  const drillsByIds = useDrillsByIds(drillIds)
  const drillsById = drillsByIds.data ?? {}

  const updateProgress = useUpdatePlanProgress()
  const completedIds = new Set(plan?.completed_drill_ids ?? [])

  // Toggle a block's completion off the current set; the optimistic hook flips
  // the cached plan immediately.
  const onToggleComplete = (blockId: string) => {
    if (!plan) return
    const next = new Set(completedIds)
    if (next.has(blockId)) next.delete(blockId)
    else next.add(blockId)
    updateProgress.mutate({ planId: plan.id, completedDrillIds: [...next] })
  }

  const onGenerate = () => generate.mutate()
  // Generate errors and failed completion toggles (#664) share one notice.
  const errorNotice = generate.error ? (
    <ErrorNotice error={generate.error} />
  ) : updateProgress.error ? (
    <ErrorNotice error={updateProgress.error} />
  ) : null

  if (planQuery.isLoading) return <LoadingState />

  if (!plan) {
    return <NoPlanState finding={finding} onGenerate={onGenerate} isPending={generate.isPending} errorNotice={errorNotice} />
  }

  const today = todayLocalDate()
  const isExpired = !!plan.valid_until && plan.valid_until < today
  const isStarter = !plan.based_on_rounds
  const sub = isExpired
    ? `Last week's plan, through ${formatDate(plan.valid_until)}`
    : `Week of ${formatDate(plan.generated_at)}${plan.valid_until ? `, through ${formatDate(plan.valid_until)}` : ''}${isStarter ? ' · starter plan' : ''}`
  const basis = isStarter
    ? 'Built from your profile answers, not your rounds yet.'
    : `Built from your last ${plan.based_on_rounds} round${plan.based_on_rounds === 1 ? '' : 's'}.`

  // Generate only once the plan has expired, or (#1056) right after the
  // 2nd/3rd round when the plan hasn't seen them.
  const promptRefresh =
    roundsWithSG.data != null && shouldPromptPlanRefresh({ planRounds: plan.based_on_rounds, roundsNow: roundsWithSG.data })
  const generateLabel = promptRefresh ? 'Update your plan with your rounds' : isExpired ? "Generate this week's plan" : null

  return (
    <div>
      {generate.isPending ? (
        <div style={{ marginBottom: 8 }}>
          <GenerateProgressBar visible />
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between" style={{ gap: 12 }}>
        <Title sub={sub} />
        {generateLabel ? <GenerateButton label={generateLabel} onGenerate={onGenerate} isPending={generate.isPending} /> : null}
      </div>

      <Finding text={finding ?? plan.ai_insight ?? 'Your practice plan'} />

      <WeekBar sessions={sessions} completedIds={completedIds} />

      {errorNotice}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" style={{ gap: 32 }}>
        <div>
          {sessions.map((session, i) => (
            <SessionBlock
              key={`session-${i}`}
              session={session}
              drillsById={drillsById}
              completedIds={completedIds}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
        <aside>
          {/* With no finding, the insight already leads the page. */}
          <WhyThisPlan insight={finding ? plan.ai_insight : null} note={plan.coach_note} basis={basis} />
          <FocusAreas areas={focusAreas} />
          {plan.id ? <FeedbackSection planId={plan.id} initial={plan.feedback ?? ''} /> : null}
          <Link to="/practice/drills" className="text-caddie-accent hover:opacity-80" style={{ fontSize: 15, fontWeight: 600 }}>
            Browse all drills{' '}
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          </Link>
        </aside>
      </div>
    </div>
  )
}
