import { Link } from 'react-router-dom'
import { useDrillsByIds, useGeneratePlan, useLatestPracticePlan } from '../../hooks/useDrills'
import { toUserMessage } from '../../lib/errors'

// ---------------------------------------------------------------------------
// Stored-plan shapes. The generated Supabase types store `drills` and
// `focus_areas` as `Json | null`; the engine writes the structured shapes
// below (see the AI-plan engine spec). We narrow them here so the render
// code is type-safe without trusting the loose Json type.
// ---------------------------------------------------------------------------

type PlanCategory = 'off_tee' | 'approach' | 'around_green' | 'putting'

type BlockType = 'warmup' | 'technical' | 'skill_game' | 'pressure_game' | 'putting'

type FocusArea = {
  category: PlanCategory
  reason: string
  article?: { title: string; slug: string } | null
}

type PlanBlock = {
  id: string
  order: number
  type: BlockType
  drill_id: string
  minutes: number
  rationale: string
  target: number | null
}

type PlanSession = {
  title: string
  total_minutes: number
  blocks: PlanBlock[]
}

type PlanDrills = { sessions: PlanSession[] }

const CATEGORY_LABEL: Record<PlanCategory, string> = {
  off_tee: 'Off the tee',
  approach: 'Approach',
  around_green: 'Around the green',
  putting: 'Putting',
}

const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  warmup: 'Warm-up',
  technical: 'Technical',
  skill_game: 'Skill game',
  pressure_game: 'Pressure game',
  putting: 'Putting',
}

const FACILITY_LABEL: Record<string, string> = {
  range: 'Range',
  short_game: 'Short game',
  putting: 'Putting green',
  sim: 'Simulator',
}

const ACCENT = '#1F3D2C'
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

function asFocusAreas(value: unknown): FocusArea[] {
  return Array.isArray(value) ? (value as FocusArea[]) : []
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
        style={{ border: `1px solid ${LINE}`, borderRadius: 4, padding: '40px 32px', maxWidth: 640 }}
      >
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
        <div style={{ marginTop: 22 }}>
          <GenerateButton
            label="Generate this week's plan"
            onGenerate={onGenerate}
            isPending={isPending}
          />
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
    <div
      className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      style={{ marginBottom: 28 }}
    >
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
          {note}
        </p>
      </div>
    </section>
  )
}

function FocusAreas({ areas }: { areas: FocusArea[] }) {
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
              {area.reason}
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

function DrillCard({
  index,
  block,
  drillName,
  facilities,
}: {
  index: number
  block: PlanBlock
  drillName: string
  facilities: string[]
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 18,
        alignItems: 'start',
        borderBottom: `1px solid ${LINE}`,
        padding: '18px 0',
      }}
    >
      {/* Left — numeral */}
      <div
        className="font-serif text-caddie-ink-mute"
        style={{ fontSize: 28, fontStyle: 'italic', lineHeight: 1, minWidth: 36 }}
      >
        {String(index).padStart(2, '0')}
      </div>

      {/* Center — name + why + equipment */}
      <div>
        <div
          className="font-serif text-caddie-ink"
          style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.2 }}
        >
          {drillName}
        </div>
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
            className="font-mono text-caddie-ink-mute"
            style={{ fontSize: 10, letterSpacing: '0.04em', marginTop: 6 }}
          >
            target: {block.target}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SessionSection({
  session,
  sessionNumber,
  drillsById,
}: {
  session: PlanSession
  sessionNumber: number
  drillsById: Record<string, { name: string; facility: string[] | null }>
}) {
  const blocks = [...session.blocks].sort((a, b) => a.order - b.order)
  return (
    <section style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18, marginBottom: 32 }}>
      <div className="kicker" style={{ marginBottom: 8 }}>
        Session {sessionNumber} · {session.total_minutes} min
      </div>
      <h2
        className="font-serif text-caddie-ink"
        style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2, marginBottom: 8 }}
      >
        {session.title}
      </h2>
      <div>
        {blocks.map((block, i) => {
          const drill = drillsById[block.drill_id]
          return (
            <DrillCard
              key={block.id ?? `${block.drill_id}-${i}`}
              index={i + 1}
              block={block}
              drillName={drill?.name ?? 'Drill'}
              facilities={drill?.facility ?? []}
            />
          )
        })}
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

  // Resolve every block's drill UUID → row in one query.
  const drillIds = drills.sessions.flatMap((s) => s.blocks.map((b) => b.drill_id))
  const drillsByIds = useDrillsByIds(drillIds)
  const drillsById = drillsByIds.data ?? {}

  const onGenerate = () => generate.mutate()
  const errorNotice = generate.error ? <ErrorNotice error={generate.error} /> : null

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
        />
      ))}

      {plan.based_on_rounds ? (
        <div
          className="font-mono text-caddie-ink-mute"
          style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', paddingTop: 4 }}
        >
          Based on your last {plan.based_on_rounds} round{plan.based_on_rounds === 1 ? '' : 's'}
        </div>
      ) : null}
    </div>
  )
}
