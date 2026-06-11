import type { BlockType, PlanCategory } from '@oga/core'

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
