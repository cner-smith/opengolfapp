import { Text } from 'react-native'
import type { BlockType, PlanCategory } from '@oga/core'
import { FONT, TYPE } from '../../lib/typography'

// Shared drill-display vocabulary + the instructions renderer, used by both the
// Practice plan screen (plan blocks) and the Drill library screen (browse-all).
// Mirrors apps/web/src/pages/practice/drillDisplay.tsx — keep the two in sync.
// Extracted because renderInstructions is substantial and must render drills
// identically across the two surfaces.

const INK = '#1C211C'
const INK_DIM = '#5C6356'

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

// Tiny markdown-ish renderer scoped to the drill `instructions` format, ported
// from web's renderInstructions. Tokenize left-to-right into complete tokens
// (**bold** | *italic* | plain), then group: each **bold** header starts a new
// paragraph; following plain/italic text belongs to that section.
type Seg = { kind: 'b' | 'i' | 't'; text: string }
export function renderInstructions(text: string) {
  const tokens = text.match(/\*\*[^*]+\*\*|\*[^*]+\*|[^*]+/g) ?? []
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
    <Text
      key={pi}
      style={[TYPE.body, { color: INK_DIM, fontSize: 14, lineHeight: 21, marginTop: pi === 0 ? 0 : 12 }]}
    >
      {para.map((seg, si) =>
        seg.kind === 'b' ? (
          <Text key={si} style={{ color: INK, fontWeight: '600' }}>
            {seg.text}
          </Text>
        ) : seg.kind === 'i' ? (
          <Text key={si} style={{ fontFamily: FONT.bodyItalic }}>
            {seg.text}
          </Text>
        ) : (
          <Text key={si}>{seg.text}</Text>
        ),
      )}
    </Text>
  ))
}
