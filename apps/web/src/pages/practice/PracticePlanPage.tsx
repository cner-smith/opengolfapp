import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { StoredBlock, StoredSession, StoredFocusArea } from '@oga/core'
import {
  useDrillsByIds,
  useGeneratePlan,
  useLatestPracticePlan,
  useSaveFeedback,
  useUpdatePlanProgress,
} from '../../hooks/useDrills'
import { toUserMessage } from '../../lib/errors'
import { BLOCK_TYPE_LABEL, CATEGORY_LABEL, FACILITY_LABEL, renderInstructions } from './drillDisplay'

// Resolved drill row from useDrillsByIds (shape mirrors getDrillsByIds' select).
type ResolvedDrill = {
  name: string
  description: string | null
  instructions: string | null
  facility: string[] | null
  source: string | null
  source_url: string | null
}

// ---------------------------------------------------------------------------
// Stored-plan shapes. The generated Supabase types store `drills` and
// `focus_areas` as `Json | null`; the engine writes the structured shapes
// defined in `@oga/core` (StoredBlock, StoredSession, StoredFocusArea).
// We narrow them here so the render code is type-safe without trusting the
// loose Json type.
// ---------------------------------------------------------------------------

type PlanDrills = { sessions: StoredSession[] }

const LINE = '#D9D2BF'

// ---------------------------------------------------------------------------
// Date helpers. `valid_until` is a date string (YYYY-MM-DD); we compare it to
// today's local date, not a timestamp, so a plan stays "current" through the
// whole of its final day regardless of the user's clock time.
// ---------------------------------------------------------------------------

function todayDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDate(value: string | null): string {
  if (!value) return ''
  // Parse a bare date string as local, not UTC, to avoid an off-by-one day.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function asDrills(value: unknown): PlanDrills {
  if (value && typeof value === 'object' && Array.isArray((value as PlanDrills).sessions)) {
    return value as PlanDrills
  }
  return { sessions: [] }
}

function asFocusAreas(value: unknown): StoredFocusArea[] {
  return Array.isArray(value) ? (value as StoredFocusArea[]) : []
}

// UI safety net: rewrite any leaked raw snake_case category enums in displayed
// prose. `approach`/`putting` are already readable words and left untouched.
// Tolerates null/undefined — a malformed plan (e.g. a focus area missing its
// `reason`) must degrade to empty text, never crash the whole page.
function normalizeCategoryProse(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\boff_tee\b/gi, 'off the tee')
    .replace(/\baround_green\b/gi, 'around the green')
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-60"
      style={{
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '0.02em',
        padding: '12px 16px',
        borderRadius: 2,
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function GenerateButton({
  label,
  onGenerate,
  isPending,
}: {
  label: string
  onGenerate: () => void
  isPending: boolean
}) {
  return (
    <PrimaryButton onClick={onGenerate} disabled={isPending}>
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
    </PrimaryButton>
  )
}

/** Keyframes inlined so this stays a single-file change instead of touching
 *  the global stylesheet for one progress bar. */
function GenerateProgressBar({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        height: 3,
        width: '100%',
        background: '#EBE5D6',
        overflow: 'hidden',
        borderRadius: 2,
      }}
    >
      <style>{`
        @keyframes oga-progress-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
      <div
        className="bg-caddie-accent"
        style={{
          position: 'absolute',
          inset: 0,
          width: '25%',
          animation: 'oga-progress-slide 1.4s ease-in-out infinite',
        }}
      />
    </div>
  )
}

function PageHeading() {
  return (
    <>
      <div className="kicker" style={{ marginBottom: 8 }}>
        Today's focus
      </div>
      <h1
        className="font-serif text-caddie-ink"
        style={{ fontSize: 28, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15 }}
      >
        Practice plan
      </h1>
    </>
  )
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <PageHeading />
      </div>
      <div
        style={{ height: 10, width: 280, background: '#EBE5D6', marginBottom: 18 }}
      />
      <div
        className="bg-caddie-surface"
        style={{ border: `1px solid ${LINE}`, borderRadius: 4, height: 120, marginBottom: 32 }}
      />
      {[0, 1].map((i) => (
        <div key={i} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18, marginBottom: 32 }}>
          <div style={{ height: 10, width: 140, background: '#EBE5D6', marginBottom: 18 }} />
          {[0, 1].map((j) => (
            <div
              key={j}
              className="bg-caddie-surface"
              style={{ border: `1px solid ${LINE}`, borderRadius: 4, height: 96, marginBottom: 12 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function NoPlanState({
  onGenerate,
  isPending,
  errorNotice,
}: {
  onGenerate: () => void
  isPending: boolean
  errorNotice: React.ReactNode
}) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <PageHeading />
      </div>
      <div
        className="bg-caddie-surface"
        style={{
          border: `1px solid ${LINE}`,
          borderRadius: 4,
          padding: '40px 32px',
          maxWidth: 640,
          position: 'relative',
        }}
      >
        {/* Top-of-card progress bar while generation is in flight. */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <GenerateProgressBar visible={isPending} />
        </div>
        <div className="kicker" style={{ marginBottom: 12 }}>
          No plan yet
        </div>
        <h2
          className="font-serif text-caddie-ink"
          style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.2 }}
        >
          A week built from your own numbers.
        </h2>
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 17, lineHeight: 1.55, marginTop: 14, maxWidth: 520 }}
        >
          Generate a week of practice sized to your strokes gained — which drills,
          in what order, with the reasoning behind each one.
        </p>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <GenerateButton
            label="Generate this week's plan"
            onGenerate={onGenerate}
            isPending={isPending}
          />
          <Link
            to="/practice/drills"
            className="font-serif text-caddie-accent hover:opacity-80"
            style={{ fontSize: 16, fontStyle: 'italic', fontWeight: 500 }}
          >
            Browse all drills →
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
      style={{
        marginTop: 18,
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
// Plan sections
// ---------------------------------------------------------------------------

function PlanHeader({
  kicker,
  insight,
  generateLabel,
  onGenerate,
  isPending,
}: {
  kicker: string
  insight: string
  generateLabel: string | null
  onGenerate: () => void
  isPending: boolean
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Wrapper conditional, not just the bar: an always-rendered margin
       *  would shift the title row by 8px in the idle (non-regenerating) state. */}
      {isPending ? (
        <div style={{ marginBottom: 8 }}>
          <GenerateProgressBar visible />
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            {kicker}
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15, maxWidth: 640 }}
          >
            {insight}
          </h1>
        </div>
        {generateLabel ? (
          <GenerateButton label={generateLabel} onGenerate={onGenerate} isPending={isPending} />
        ) : null}
      </div>
    </div>
  )
}

function ReasoningPanel({ note }: { note: string }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div className="kicker" style={{ marginBottom: 12 }}>
        The reasoning
      </div>
      <div
        className="bg-caddie-surface"
        style={{ border: `1px solid ${LINE}`, borderRadius: 4, padding: '22px 24px', maxWidth: 720 }}
      >
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 17, lineHeight: 1.6 }}
        >
          {normalizeCategoryProse(note)}
        </p>
      </div>
    </section>
  )
}

function FocusAreas({ areas }: { areas: StoredFocusArea[] }) {
  if (areas.length === 0) return null
  return (
    <section style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18, marginBottom: 32 }}>
      <div className="kicker" style={{ marginBottom: 18 }}>
        What to work on
      </div>
      <div style={{ display: 'grid', gap: 14, maxWidth: 720 }}>
        {areas.map((area, i) => (
          <div key={`${area.category}-${i}`}>
            <div
              className="font-serif text-caddie-ink"
              style={{ fontSize: 17, fontWeight: 500 }}
            >
              {CATEGORY_LABEL[area.category] ?? area.category}
            </div>
            <p
              className="text-caddie-ink-dim"
              style={{ fontSize: 15, lineHeight: 1.5, marginTop: 4 }}
            >
              {normalizeCategoryProse(area.reason)}
            </p>
            {area.article ? (
              <Link
                to={`/learn/${area.article.slug}`}
                className="text-caddie-accent hover:opacity-80"
                style={{ display: 'inline-block', marginTop: 6, fontSize: 13, fontWeight: 600 }}
              >
                {area.article.title}{' '}
                <span className="font-serif" style={{ fontStyle: 'italic' }}>
                  →
                </span>
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function CompletionToggle({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={checked ? 'bg-caddie-accent text-caddie-accent-ink' : 'bg-caddie-surface text-caddie-accent-ink'}
      style={{
        width: 18,
        height: 18,
        borderRadius: 2,
        border: checked ? 'none' : '1px solid #9F9580',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        marginTop: 4,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {checked ? (
        <svg
          aria-hidden="true"
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          style={{ display: 'block' }}
        >
          <path
            d="M2.5 6.2 5 8.7 9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  )
}

function DrillCard({
  index,
  block,
  drill,
  completed,
  onToggleComplete,
}: {
  index: number
  block: StoredBlock
  drill: ResolvedDrill | undefined
  completed: boolean
  onToggleComplete: () => void
}) {
  const [open, setOpen] = useState(false)
  const drillName = drill?.name ?? 'Drill'
  const facilities = drill?.facility ?? []
  const instructions = drill?.instructions?.trim() || drill?.description?.trim() || ''
  const canExpand = instructions.length > 0
  const nameClass = completed ? 'text-caddie-ink-mute' : 'text-caddie-ink'

  return (
    <div style={{ borderBottom: `1px solid ${LINE}`, padding: '18px 0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto 1fr auto',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* Left — completion checkbox (separate interactive control) */}
        <CompletionToggle
          checked={completed}
          label={`Mark "${drillName}" done`}
          onToggle={onToggleComplete}
        />

        {/* Serif numeral */}
        <div
          className="font-serif text-caddie-ink-mute"
          style={{ fontSize: 28, fontStyle: 'italic', lineHeight: 1, minWidth: 32 }}
        >
          {String(index).padStart(2, '0')}
        </div>

        {/* Center — name (expand affordance) + why + equipment */}
        <div>
          {canExpand ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={`drill-detail-${block.id}`}
              className={`font-serif hover:opacity-80 ${nameClass}`}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                fontSize: 19,
                fontStyle: 'italic',
                lineHeight: 1.2,
                textAlign: 'left',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
            >
              <span>{drillName}</span>
              <span
                className="font-mono text-caddie-ink-mute"
                aria-hidden="true"
                style={{ fontSize: 15, fontStyle: 'normal', lineHeight: 1 }}
              >
                {open ? '−' : '+'}
              </span>
            </button>
          ) : (
            <div
              className={`font-serif ${nameClass}`}
              style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.2 }}
            >
              {drillName}
            </div>
          )}
          {block.rationale ? (
            <p
              className="font-serif text-caddie-ink-dim"
              style={{ fontSize: 15, lineHeight: 1.5, marginTop: 6 }}
            >
              {block.rationale}
            </p>
          ) : null}
          {facilities.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {facilities.map((f) => (
                <span
                  key={f}
                  className="font-mono bg-caddie-surface-2 text-caddie-ink-dim"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 2,
                  }}
                >
                  {FACILITY_LABEL[f] ?? f}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right — minutes + type tag + optional target */}
        <div style={{ textAlign: 'right', minWidth: 72 }}>
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1 }}
          >
            {block.minutes} min
          </div>
          <div
            className="font-mono text-caddie-accent"
            style={{
              fontSize: 9,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 6,
            }}
          >
            {BLOCK_TYPE_LABEL[block.type] ?? block.type}
          </div>
          {block.target != null ? (
            <div
              className="font-mono text-caddie-ink-dim"
              style={{ fontSize: 10, letterSpacing: '0.04em', marginTop: 10 }}
            >
              Target: {block.target}
            </div>
          ) : null}
        </div>
      </div>

      {/* Expanded — full-width instructions, hairline-separated, no shadow */}
      {canExpand && open ? (
        <div id={`drill-detail-${block.id}`} style={{ borderTop: `1px solid ${LINE}`, marginTop: 16, paddingTop: 16, maxWidth: 660 }}>
          {renderInstructions(instructions)}
          {drill?.source ? (
            <div
              className="font-mono text-caddie-ink-mute"
              style={{
                fontSize: 10,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginTop: 14,
              }}
            >
              via{' '}
              {drill.source_url ? (
                <a
                  href={drill.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-caddie-accent hover:opacity-80"
                >
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
  )
}

function SessionSection({
  session,
  sessionNumber,
  drillsById,
  completedIds,
  onToggleComplete,
}: {
  session: StoredSession
  sessionNumber: number
  drillsById: Record<string, ResolvedDrill>
  completedIds: Set<string>
  onToggleComplete: (blockId: string) => void
}) {
  const blocks = [...(session.blocks ?? [])].sort((a, b) => a.order - b.order)
  const doneCount = blocks.filter((b) => b.id != null && completedIds.has(b.id)).length
  return (
    <section style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18, marginBottom: 32 }}>
      <div className="kicker" style={{ marginBottom: 8 }}>
        Session {sessionNumber} · {session.total_minutes} min
        {doneCount > 0 ? ` · ${doneCount} of ${blocks.length} done` : ''}
      </div>
      <h2
        className="font-serif text-caddie-ink"
        style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2, marginBottom: 8 }}
      >
        {session.title}
      </h2>
      <div>
        {blocks.map((block, i) => {
          const drill = block.drill_id ? drillsById[block.drill_id] : undefined
          const completed = block.id != null && completedIds.has(block.id)
          return (
            <DrillCard
              key={block.id ?? `${block.drill_id}-${i}`}
              index={i + 1}
              block={block}
              drill={drill}
              completed={completed}
              onToggleComplete={() => {
                if (block.id != null) onToggleComplete(block.id)
              }}
            />
          )
        })}
      </div>
    </section>
  )
}

const FEEDBACK_MAX = 500

function FeedbackSection({ planId, initial }: { planId: string; initial: string }) {
  const saveFeedback = useSaveFeedback()
  const [value, setValue] = useState(initial)
  // Track the last value we've persisted so blur only saves real edits and the
  // "Saved" indicator clears the moment the user starts editing again.
  const [savedValue, setSavedValue] = useState(initial)

  const handleBlur = () => {
    const next = value.trim()
    if (next === savedValue.trim()) return
    if (next.length === 0 && savedValue.trim().length === 0) return
    saveFeedback.mutate(
      { planId, feedback: next },
      { onSuccess: () => setSavedValue(next) },
    )
  }

  const showSaved = !saveFeedback.isPending && value.trim() === savedValue.trim() && savedValue.trim().length > 0

  return (
    <section style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18, marginBottom: 32, maxWidth: 660 }}>
      <div className="kicker" style={{ marginBottom: 8 }}>
        Before next week
      </div>
      <p
        className="font-serif text-caddie-ink-dim"
        style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 12 }}
      >
        One note on how this plan landed — what worked, what felt off. Next week's
        plan reads it.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        maxLength={FEEDBACK_MAX}
        rows={4}
        className="font-sans bg-caddie-surface text-caddie-ink"
        style={{
          width: '100%',
          border: `1px solid ${LINE}`,
          borderRadius: 2,
          padding: '12px 14px',
          fontSize: 15,
          lineHeight: 1.5,
          resize: 'vertical',
        }}
      />
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}
      >
        <span
          className={`font-mono ${saveFeedback.isError ? 'text-caddie-neg' : 'text-caddie-ink-mute'}`}
          style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          {saveFeedback.isError ? "Couldn't save — try again" : showSaved ? 'Saved' : ''}
        </span>
        <span
          className="font-mono text-caddie-ink-mute"
          style={{ fontSize: 10, letterSpacing: '0.04em' }}
        >
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
  const generate = useGeneratePlan()

  const plan = planQuery.data
  const drills = asDrills(plan?.drills)
  const focusAreas = asFocusAreas(plan?.focus_areas)

  // Resolve every block's drill UUID → row in one query. drill_id is string | undefined
  // (StoredBlock shape); filter out any undefined before passing to useDrillsByIds.
  const drillIds = drills.sessions.flatMap((s) =>
    s.blocks.map((b) => b.drill_id).filter((id): id is string => id !== undefined),
  )
  const drillsByIds = useDrillsByIds(drillIds)
  const drillsById = drillsByIds.data ?? {}

  const updateProgress = useUpdatePlanProgress()
  const completedIds = new Set(plan?.completed_drill_ids ?? [])

  // Toggle a block's completion: compute the next array off the current set and
  // hand it to the optimistic hook, which flips the cached plan immediately.
  const onToggleComplete = (blockId: string) => {
    if (!plan) return
    const next = new Set(completedIds)
    if (next.has(blockId)) next.delete(blockId)
    else next.add(blockId)
    updateProgress.mutate({ planId: plan.id, completedDrillIds: [...next] })
  }

  const onGenerate = () => generate.mutate()
  // Surface generate errors and failed drill-completion toggles (#664 —
  // updateProgress was fire-and-forget; a failed toggle silently reverted
  // on next load) in the same page-level notice slot.
  const errorNotice = generate.error ? (
    <ErrorNotice error={generate.error} />
  ) : updateProgress.error ? (
    <ErrorNotice error={updateProgress.error} />
  ) : null

  if (planQuery.isLoading) {
    return <LoadingState />
  }

  if (!plan) {
    return (
      <NoPlanState
        onGenerate={onGenerate}
        isPending={generate.isPending}
        errorNotice={errorNotice}
      />
    )
  }

  // Plan exists. Decide current vs. soft-expired by comparing date strings
  // (lexicographic comparison is correct for ISO YYYY-MM-DD).
  const today = todayDateString()
  const isExpired = !!plan.valid_until && plan.valid_until < today

  const kicker = isExpired
    ? `Last week's plan · valid through ${formatDate(plan.valid_until)}`
    : `Practice plan · week of ${formatDate(plan.generated_at)}${plan.valid_until ? ` · valid through ${formatDate(plan.valid_until)}` : ''}`

  // No-regenerate-within-window: only offer Generate once the plan has expired.
  const generateLabel = isExpired ? "Generate this week's plan" : null

  return (
    <div>
      <PlanHeader
        kicker={kicker}
        insight={plan.ai_insight ?? 'Your practice plan'}
        generateLabel={generateLabel}
        onGenerate={onGenerate}
        isPending={generate.isPending}
      />

      {errorNotice}

      {plan.coach_note ? <ReasoningPanel note={plan.coach_note} /> : null}

      <FocusAreas areas={focusAreas} />

      {drills.sessions.map((session, i) => (
        <SessionSection
          key={`session-${i}`}
          session={session}
          sessionNumber={i + 1}
          drillsById={drillsById}
          completedIds={completedIds}
          onToggleComplete={onToggleComplete}
        />
      ))}

      {plan.id ? <FeedbackSection planId={plan.id} initial={plan.feedback ?? ''} /> : null}

      {plan.based_on_rounds ? (
        <div
          className="font-mono text-caddie-ink-mute"
          style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', paddingTop: 4 }}
        >
          Based on your last {plan.based_on_rounds} round{plan.based_on_rounds === 1 ? '' : 's'}
        </div>
      ) : null}

      <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 28, paddingTop: 18 }}>
        <Link
          to="/practice/drills"
          className="font-serif text-caddie-accent hover:opacity-80"
          style={{ fontSize: 17, fontStyle: 'italic', fontWeight: 500 }}
        >
          Browse all drills{' '}
          <span style={{ fontStyle: 'italic' }}>→</span>
        </Link>
      </div>
    </div>
  )
}
