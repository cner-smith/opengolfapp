import { useEffect, useState, type ReactNode } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { formatSG, inferHoleStats, roundFocusHeadline, type RoundFocus } from '@oga/core'
import type { Database } from '@oga/supabase'
import { TYPE } from '../../../lib/typography'
import { Key, KeyText } from '../../paper/Paper'
import { GolfMark } from '../../paper/GolfMark'
import { Icon } from '../../paper/icons'
import { P } from '../../paper/tokens'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type DrillRow = Database['public']['Tables']['drills']['Row']

// Past-round Scorecard tab (#611 §19.7), split out of the route screen to keep
// it under the 1000-line limit: totals with a hero-size score, the SG rows,
// the focus lede + drills, and the editable hole table ("Your card").

export const signed = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`)
const sg = (n: number) => formatSG(n).replace('-', '−')

const COL = { hole: 34, par: 34, score: 56, putts: 44, fwy: 36, green: 46 }

export function RoundScorecardTab({
  round,
  holes,
  scoresByHoleId,
  shotCountByHoleScoreId,
  shotsByHoleScoreId,
  runningScore,
  runningPar,
  handicap,
  focus,
  drills,
  onCommit,
  onOpenShots,
  children,
}: {
  round: RoundRow
  /** Sorted by hole number. */
  holes: HoleRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  shotCountByHoleScoreId: Map<string, number>
  shotsByHoleScoreId: Map<string, ShotRow[]>
  runningScore: number
  runningPar: number
  /** The player's handicap index, for the "vs a N handicap" caption. */
  handicap: number | null
  focus: RoundFocus | null
  drills: DrillRow[]
  onCommit: (holeId: string, patch: { score?: number; putts?: number | null }) => void
  onOpenShots: (hole: HoleRow) => void
  /** Tee selector + Save SG + Delete, below the card. */
  children: ReactNode
}) {
  const diff = runningScore - runningPar
  const sgRows: { label: string; value: number | null }[] = [
    { label: 'Off the tee', value: round.sg_off_tee },
    { label: 'Approach', value: round.sg_approach },
    { label: 'Around the green', value: round.sg_around_green },
    { label: 'Putting', value: round.sg_putting },
  ]

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 40 }}>
      {/* Totals: the score at hero size, to-par beside it, SG on the right. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18 }}>
        <Text style={[TYPE.serif, { fontSize: 54, lineHeight: 62, letterSpacing: -1.5, color: runningPar === 0 ? P.ink35 : P.ink }]}>
          {runningPar === 0 ? '—' : runningScore}
        </Text>
        <View style={{ flex: 1, paddingLeft: 10, paddingBottom: 8 }}>
          {runningPar > 0 && (
            <>
              <Text style={[TYPE.serif, { fontSize: 22, lineHeight: 26, color: P.ink }]}>{signed(diff)}</Text>
              <Text style={[TYPE.body, { fontSize: 12, color: P.ink }]}>to par · {runningPar}</Text>
            </>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', paddingBottom: 8 }}>
          <Text
            style={[
              TYPE.serif,
              {
                fontSize: 22,
                lineHeight: 26,
                color: round.sg_total == null ? P.ink35 : round.sg_total < 0 ? P.neg : P.ink,
              },
            ]}
          >
            {round.sg_total == null ? '—' : sg(round.sg_total)}
          </Text>
          <Text style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink, textAlign: 'right' }]}>
            strokes gained{handicap != null ? `\nvs a ${handicap} handicap` : ''}
          </Text>
        </View>
      </View>

      <View style={{ borderTopWidth: 1, borderColor: P.ink }}>
        {sgRows.map((row) => (
          <View
            key={row.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 40,
              borderBottomWidth: 1,
              borderColor: P.line,
            }}
          >
            <Text style={[TYPE.body, { fontSize: 15, color: P.ink }]}>{row.label}</Text>
            <Text
              style={[
                TYPE.kicker,
                { fontSize: 15, color: row.value == null ? P.ink35 : row.value < 0 ? P.neg : P.ink },
              ]}
            >
              {row.value == null ? '—' : sg(row.value)}
            </Text>
          </View>
        ))}
      </View>

      {focus && <RoundNudge focus={focus} picks={drills} />}

      <HoleTable
        holes={holes}
        scoresByHoleId={scoresByHoleId}
        shotCountByHoleScoreId={shotCountByHoleScoreId}
        shotsByHoleScoreId={shotsByHoleScoreId}
        onCommit={onCommit}
        onOpenShots={onOpenShots}
      />

      {children}
    </ScrollView>
  )
}

// Post-round nudge — mirrors the web RoundSummary's RoundNudge. Drill keys
// link to the practice library: web sends its chips to /practice/drills;
// mobile's equivalent route is /(app)/drills (shipped #511/#519).
function RoundNudge({ focus, picks }: { focus: RoundFocus; picks: DrillRow[] }) {
  const router = useRouter()
  return (
    <View style={{ marginTop: 28 }}>
      <Text style={[TYPE.serif, { fontSize: 22, lineHeight: 28, color: P.ink }]}>{roundFocusHeadline(focus)}</Text>
      {picks.length > 0 && (
        <>
          <Text style={[TYPE.body, { fontSize: 14, color: P.ink, marginTop: 6, marginBottom: 10 }]}>
            {picks.length === 1 ? 'One drill' : `${picks.length === 2 ? 'Two' : picks.length} drills`} for your next
            range session:
          </Text>
          <View style={{ gap: 10 }}>
            {picks.map((drill) => (
              <Key
                key={drill.id}
                accessibilityLabel={`${drill.name}${drill.duration_min ? `, ${drill.duration_min} minutes` : ''}`}
                onPress={() => router.push('/(app)/drills')}
                faceStyle={{ minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', gap: 8 }}
              >
                <Text style={[TYPE.body, { flex: 1, fontSize: 15, color: P.ink }]}>
                  {drill.name}
                  {drill.duration_min ? (
                    <Text style={[TYPE.kicker, { fontSize: 13 }]}>{`  ·  ${drill.duration_min} min`}</Text>
                  ) : null}
                </Text>
                <Icon.next size={16} />
              </Key>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

function HoleTable({
  holes,
  scoresByHoleId,
  shotCountByHoleScoreId,
  shotsByHoleScoreId,
  onCommit,
  onOpenShots,
}: {
  holes: HoleRow[]
  scoresByHoleId: Map<string, HoleScoreRow>
  shotCountByHoleScoreId: Map<string, number>
  shotsByHoleScoreId: Map<string, ShotRow[]>
  onCommit: (holeId: string, patch: { score?: number; putts?: number | null }) => void
  onOpenShots: (hole: HoleRow) => void
}) {
  // Per-nine totals for the title's right side ("Front nine · 47 (+11)").
  const nine = (lo: number, hi: number) => {
    let score = 0
    let par = 0
    for (const h of holes) {
      if (h.number < lo || h.number > hi) continue
      const hs = scoresByHoleId.get(h.id)
      if (hs?.score != null && hs.score > 0) {
        score += hs.score
        par += hs.par ?? h.par
      }
    }
    return score > 0 ? { score, toPar: score - par } : null
  }
  const front = nine(1, 9)
  const back = holes.length > 9 ? nine(10, 99) : null
  const parts: { label: string; t: { score: number; toPar: number } }[] = []
  if (front) parts.push({ label: holes.length > 9 ? 'Out' : 'Front nine', t: front })
  if (back) parts.push({ label: 'In', t: back })

  const head = (label: string, width: number, align: 'left' | 'center' = 'center') => (
    <Text style={[TYPE.body, { width, textAlign: align, fontSize: 12, color: P.ink }]}>{label}</Text>
  )

  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text style={[TYPE.serif, { fontSize: 24, color: P.ink }]}>Your card</Text>
        <Text style={[TYPE.body, { flexShrink: 1, fontSize: 13, color: P.ink, textAlign: 'right' }]}>
          {parts.map((p, i) => (
            <Text key={p.label}>
              {i > 0 ? '  ·  ' : ''}
              {p.label} · <Text style={[TYPE.serif, { fontSize: 15 }]}>{p.t.score}</Text> ({signed(p.t.toPar)})
            </Text>
          ))}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderColor: P.ink,
        }}
      >
        {head('Hole', COL.hole, 'left')}
        {head('Par', COL.par)}
        {head('Score', COL.score)}
        {head('Putts', COL.putts)}
        {head('Fwy', COL.fwy)}
        {head('Green', COL.green)}
        <Text style={[TYPE.body, { flex: 1, textAlign: 'right', fontSize: 12, color: P.ink }]}>Shots</Text>
      </View>
      {holes.map((h) => {
        const hs = scoresByHoleId.get(h.id)
        const score = hs?.score ?? 0
        // Per-round par override (#710) — hole_scores.par wins over the
        // course hole's par when the player corrected it.
        const par = hs?.par ?? h.par
        const shotCount = hs ? shotCountByHoleScoreId.get(hs.id) ?? 0 : 0
        // FIR/GIR: prefer the persisted hole_scores columns — web parity,
        // a manual/web-set value wins (apps/web useRoundActions) — else
        // infer from the hole's placed shots. par-3 fairway → null (n/a).
        const inferred = inferHoleStats(hs ? shotsByHoleScoreId.get(hs.id) ?? [] : [], par)
        const fairway = hs?.fairway_hit ?? inferred.fairway
        const gir = hs?.gir ?? inferred.gir
        return (
          <View
            key={h.id}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderColor: P.line }}
          >
            <Text style={[TYPE.body, { width: COL.hole, fontSize: 15, color: P.ink }]}>{h.number}</Text>
            <Text style={[TYPE.kicker, { width: COL.par, textAlign: 'center', fontSize: 15, color: P.ink }]}>{par}</Text>
            <View style={{ width: COL.score, alignItems: 'center', justifyContent: 'center' }}>
              {score > 0 && <GolfMark toPar={score - par} seed={h.number} />}
              <ScoreCell
                value={score}
                width={COL.score}
                serif
                label={`Hole ${h.number} score`}
                onCommit={(n) => onCommit(h.id, { score: n })}
              />
            </View>
            <ScoreCell
              value={hs?.putts ?? null}
              width={COL.putts}
              label={`Hole ${h.number} putts`}
              onCommit={(n) => onCommit(h.id, { putts: n > 0 ? n : null })}
            />
            {([fairway, gir] as const).map((v, i) => (
              <Text
                key={i}
                style={[
                  TYPE.body,
                  { width: i === 0 ? COL.fwy : COL.green, textAlign: 'center', fontSize: 15, color: v === true ? P.ink : P.ink35 },
                ]}
              >
                {v === true ? '✓' : v === false ? '·' : '—'}
              </Text>
            ))}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Key
                accessibilityLabel={
                  shotCount > 0
                    ? `Hole ${h.number}, ${shotCount} shot${shotCount === 1 ? '' : 's'}, edit`
                    : `Hole ${h.number}, add shots`
                }
                onPress={() => onOpenShots(h)}
                hitSlop={5}
                faceStyle={{ minHeight: 34, paddingHorizontal: 10, flexDirection: 'row', gap: 2 }}
              >
                <KeyText size={13}>Shots</KeyText>
                <Icon.next size={14} />
              </Key>
            </View>
          </View>
        )
      })}
    </View>
  )
}

// Inline numeric cell for the editable scorecard (#514). Score 0 / null
// renders as the em-dash placeholder — a fresh past round seeds every
// hole_score at 0, so 0 means "not entered yet", not "scored zero".
function ScoreCell({
  value,
  onCommit,
  label,
  width,
  serif = false,
}: {
  value: number | null
  onCommit: (n: number) => void
  label: string
  width: number
  serif?: boolean
}) {
  const [text, setText] = useState(value && value > 0 ? String(value) : '')
  // Re-sync when the persisted value changes from elsewhere (e.g. a
  // Save-SG recompute or a sibling edit) so the cell never goes stale.
  useEffect(() => {
    setText(value && value > 0 ? String(value) : '')
  }, [value])
  return (
    <TextInput
      value={text}
      onChangeText={(t) => setText(t.replace(/[^0-9]/g, '').slice(0, 2))}
      onEndEditing={() => {
        const n = text === '' ? 0 : parseInt(text, 10)
        if (n !== (value ?? 0)) onCommit(n)
      }}
      keyboardType="number-pad"
      returnKeyType="done"
      placeholder="—"
      placeholderTextColor={P.ink35}
      selectTextOnFocus
      accessibilityLabel={label}
      style={[
        serif ? TYPE.serif : TYPE.kicker,
        { width, minHeight: 44, textAlign: 'center', fontSize: serif ? 20 : 15, paddingVertical: 0, color: P.ink },
      ]}
    />
  )
}
