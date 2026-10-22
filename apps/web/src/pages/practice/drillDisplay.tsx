import type { BlockType, PlanCategory, StoredSession } from '@oga/core'

// Shared drill-display vocabulary + the instructions renderer, used by both
// PracticePlanPage (plan blocks) and DrillLibraryPage (browse-all). Extracted
// because renderInstructions is substantial and must stay identical across the
// two surfaces — the human-readable face of the @oga/core enums lives here.

export const CATEGORY_LABEL: Record<PlanCategory, string> = {
  off_tee: 'Off the tee',
  approach: 'Approach',
  around_green: 'Around the green',
  putting: 'Putting',
}

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  warmup: 'Warm-up',
  blocked: 'Blocked',
  random: 'Random',
  skill_game: 'Skill game',
  pressure_game: 'Pressure game',
  on_course: 'On course',
}

export const FACILITY_LABEL: Record<string, string> = {
  range: 'Range',
  short_game: 'Short game',
  putting: 'Putting green',
  sim: 'Simulator',
  course: 'Course',
}

// The stored plan's `drills` column is `Json | null`; the engine writes
// { sessions: StoredSession[] }. Narrowed here for both the plan and the
// library's "In this week's plan" toggle.
export function planSessions(value: unknown): StoredSession[] {
  const sessions = (value as { sessions?: unknown } | null)?.sessions
  return Array.isArray(sessions) ? (sessions as StoredSession[]) : []
}

// Tiny markdown-ish renderer scoped to the drill `instructions` format.
// Tokenizes left-to-right into complete tokens (**bold** | *italic* | plain)
// then groups: each **bold** header starts a new paragraph, following
// plain/italic text belongs to that section.
// The continuous seed format `**Why.** prose **Setup.** prose` produces one
// paragraph per section. Complete-token matching (not a lookahead) avoids the
// closing-**+body+opening-** ambiguity of the prior split approach.
// No dangerouslySetInnerHTML — all text nodes + React elements only.
export function renderInstructions(text: string): React.ReactNode {
  const tokens = text.match(/\*\*[^*]+\*\*|\*[^*]+\*|[^*]+/g) ?? []
  type Seg = { kind: 'b' | 'i' | 't'; text: string }
  const paras: Seg[][] = []
  let cur: Seg[] = []
  for (const tok of tokens) {
    if (tok.startsWith('**')) {
      if (cur.length) paras.push(cur)
      cur = [{ kind: 'b', text: tok.slice(2, -2) }]
    } else if (tok.startsWith('*')) {
      cur.push({ kind: 'i', text: tok.slice(1, -1) })
    } else {
      cur.push({ kind: 't', text: tok })
    }
  }
  if (cur.length) paras.push(cur)

  return paras.map((para, pi) => (
    <p
      key={pi}
      className="font-serif text-caddie-ink-dim"
      style={{ fontSize: 15, lineHeight: 1.6, marginTop: pi === 0 ? 0 : 12 }}
    >
      {para.map((seg, si) =>
        seg.kind === 'b' ? (
          <strong key={si} className="text-caddie-ink" style={{ fontWeight: 600 }}>
            {seg.text}
          </strong>
        ) : seg.kind === 'i' ? (
          <em key={si}>{seg.text}</em>
        ) : (
          <span key={si}>{seg.text}</span>
        ),
      )}
    </p>
  ))
}

// One colour per practice mode for the stacked minutes bars and the drill
// swatches: forest tints for reps, amber for the pressure game, paper greys
// for the warm-up and the course.
export const MODE_COLOR: Record<BlockType, string> = {
  warmup: '#C9C1AC',
  blocked: '#1F3D2C',
  random: '#4F6B58',
  skill_game: '#8FA493',
  pressure_game: '#A66A1F',
  on_course: '#5C6356',
}

const MODE_ORDER: BlockType[] = ['warmup', 'blocked', 'random', 'skill_game', 'pressure_game', 'on_course']

export function ModeSwatch({ type }: { type: BlockType }) {
  return (
    <span
      aria-hidden
      style={{ display: 'inline-block', width: 8, height: 8, background: MODE_COLOR[type] ?? '#8A8B7E', borderRadius: 1, flexShrink: 0 }}
    />
  )
}

/** A session's minutes as one bar stacked by practice mode, the modes named under it. */
export function ModeBar({ parts }: { parts: { type: BlockType; minutes: number }[] }) {
  const byMode = new Map<BlockType, number>()
  for (const p of parts) byMode.set(p.type, (byMode.get(p.type) ?? 0) + p.minutes)
  const modes = MODE_ORDER.filter((m) => (byMode.get(m) ?? 0) > 0)
  if (modes.length === 0) return null
  return (
    <div>
      <div
        role="img"
        aria-label={modes.map((m) => `${BLOCK_TYPE_LABEL[m]} ${byMode.get(m)} min`).join(', ')}
        style={{ display: 'flex', height: 10, gap: 2 }}
      >
        {modes.map((m) => (
          <div key={m} style={{ flex: byMode.get(m)!, background: MODE_COLOR[m], borderRadius: 1 }} />
        ))}
      </div>
      <div className="text-caddie-ink-dim" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, marginTop: 8 }}>
        {modes.map((m) => (
          <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ModeSwatch type={m} />
            {BLOCK_TYPE_LABEL[m]} <span className="font-serif tabular text-caddie-ink">{byMode.get(m)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
