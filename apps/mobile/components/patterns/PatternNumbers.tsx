import { Text, View } from 'react-native'
import Svg from 'react-native-svg'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import {
  SHOT_SHAPE_LABELS,
  SHOT_START_LINE_LABELS,
  categoriesFor,
  distanceText as dist,
  distanceUnitAbbr as unitWord,
  missTally,
  shapeTally,
  tallyWords,
  wholeDistance as num,
  startLineTally,
  startShapeMatrix,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
  type PlanCategory,
  type ColourBy,
  type RecordedTally,
} from '@oga/core'
import { PressableTouch } from '../ui/PressableTouch'
import { CATEGORY_LABEL } from '../practice/drillDisplay'
import { TYPE } from '../../lib/typography'
import { Key, KeyText } from '../paper/Paper'
import { PaperTile } from '../paper/Section'
import { FONT_CAP, P } from '../paper/tokens'
import { Marker } from './chartParts'
import { styledCategories } from './layers'

// The numbers under the chart: two tiles for the pattern's size and where it
// finishes, then rows (DESIGN.md Stat tile). Shape and start line are printed
// tallies of what was recorded, so one word never hides the spread. Values are
// upright serif; the finding sentence keeps the italic. Same rows as the web.

const ROW = { borderBottomWidth: 1, borderColor: P.line, paddingVertical: 12 }

// The row stretches both tiles to the taller one; the face must fill its
// wrapper too, or the shorter tile's hard shadow shows as a grey slab below it.
function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <PaperTile style={{ flex: 1 }} innerStyle={{ flex: 1 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 6 }]}>{label}</Text>
      <Text maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} adjustsFontSizeToFit style={[TYPE.serifUpright, { color: P.ink, fontSize: 26, lineHeight: 32 }]}>
        {value}
      </Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginTop: 4 }]}>{note}</Text>
    </PaperTile>
  )
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={ROW}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15, flexShrink: 1 }]}>{label}</Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 20 }]}>{value}</Text>
      </View>
      {note ? <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17, marginTop: 4 }]}>{note}</Text> : null}
    </View>
  )
}

/** One column per value, left to right as the ball goes: its count over a bar.
 *  Tapping it colours the chart by this axis. */
function TallyRow<K extends string>({ label, tally, words, by, leftHanded, onColour }: {
  label: string
  tally: RecordedTally<K>
  words: { value: string; note: string }
  by: 'shape' | 'start'
  leftHanded: boolean
  onColour: (by: ColourBy) => void
}) {
  const cats = styledCategories(by, leftHanded)
  const max = Math.max(1, ...cats.map((c) => tally.counts[c.key as K]))
  return (
    <View style={ROW}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15 }]}>{label}</Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 20, flexShrink: 1, textAlign: 'right' }]}>{words.value}</Text>
      </View>
      {tally.recorded > 0 && (
        <PressableTouch
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${cats.map((c) => `${c.label} ${tally.counts[c.key as K]}`).join(', ')}`}
          accessibilityHint={`Colours the chart by ${label.toLowerCase()}`}
          onPress={() => onColour(by)}
          style={{ flexDirection: 'row', gap: 4, marginTop: 8, paddingVertical: 4 }}
        >
          {cats.map((c) => {
            const v = tally.counts[c.key as K]
            return (
              <View key={c.key} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { fontSize: 14, color: v ? P.ink : P.inkDim }]}>{v}</Text>
                <View style={{ height: 22, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-end', borderBottomWidth: 1, borderColor: P.lineStrong }}>
                  <View style={{ width: '62%', height: `${(v / max) * 100}%`, backgroundColor: P.inkDim, opacity: 0.85 }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Svg width={10} height={10} viewBox="0 0 10 10">
                    <Marker x={5} y={5} r={3.2} glyph={c.glyph} color={c.color} />
                  </Svg>
                  <Text maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} style={[TYPE.body, { fontSize: 12, color: P.inkDim }]}>{c.label}</Text>
                </View>
              </View>
            )
          })}
        </PressableTouch>
      )}
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17, marginTop: 6 }]}>{words.note}.</Text>
    </View>
  )
}

// Start line × shape: push-fade, pull-hook… from shots with both recorded.
function Matrix({ points, leftHanded }: { points: DispersionPoint[]; leftHanded: boolean }) {
  const m = startShapeMatrix(points)
  if (m.total === 0) return null
  const rows = categoriesFor('start', leftHanded)
  const cols = categoriesFor('shape', leftHanded)
  const name = (sl: string, sh: string) =>
    `${SHOT_START_LINE_LABELS[sl as keyof typeof SHOT_START_LINE_LABELS].toLowerCase()}-${SHOT_SHAPE_LABELS[sh as keyof typeof SHOT_SHAPE_LABELS].toLowerCase()}`
  const count = (sl: string, sh: string) => m.counts[sl as keyof typeof m.counts][sh as keyof (typeof m.counts)['pull']]
  const cell = { flex: 1, alignItems: 'center' as const, paddingVertical: 5 }
  return (
    <View style={ROW}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15, marginBottom: 8 }]}>Start line and shape</Text>
      <View accessible accessibilityLabel={`Start line and shape. ${rows.map((r) => `${r.label}: ${cols.map((c) => `${count(r.key, c.key)} ${c.label.toLowerCase()}`).join(', ')}`).join('. ')}`}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 56 }} />
          {cols.map((c) => (
            <View key={c.key} style={cell}>
              <Text maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} style={[TYPE.body, { fontSize: 11, color: P.inkDim }]}>{c.label}</Text>
            </View>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: '#ECE6D8' }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { width: 56, fontSize: 12, color: P.inkDim }]}>{r.label}</Text>
            {cols.map((c) => {
              const v = count(r.key, c.key)
              const top = m.commonest?.startLine === r.key && m.commonest?.shape === c.key
              return (
                <View key={c.key} style={[cell, top ? { backgroundColor: P.well } : null]}>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[top ? TYPE.serif : TYPE.serifUpright, { fontSize: 14, color: v ? P.ink : '#8A8B7E' }]}>{v || '·'}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </View>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17, marginTop: 6 }]}>
        {m.commonest ? `Most common: ${name(m.commonest.startLine, m.commonest.shape)} (${m.commonest.count}). ` : ''}
        From the {m.total} shot{m.total === 1 ? '' : 's'} with both recorded.
      </Text>
    </View>
  )
}

export function PatternNumbers({
  stats,
  points,
  typicalYards,
  unit,
  shotsNote,
  filtered,
  teeShots,
  leftHanded,
  onColour,
  practice,
  onExport,
  sharing,
}: {
  stats: DispersionStats
  points: DispersionPoint[]
  typicalYards: number | null
  unit: DistanceUnit
  shotsNote: string
  filtered: boolean
  teeShots: boolean
  leftHanded: boolean
  onColour: (by: ColourBy) => void
  practice: PlanCategory
  onExport: () => void
  sharing: boolean
}) {
  const router = useRouter()
  const n = points.length
  const u = unitWord(unit)
  const pair = (a: number, b: number) => `${num(a, unit)} × ${num(b, unit)} ${u}`
  const finish = stats.avgAimDistance != null ? stats.avgAimDistance + stats.avgDistanceOffset : null
  const misses = missTally(points)
  const shortMore = misses.short >= misses.long
  const shape = shapeTally(points, leftHanded)
  const start = startLineTally(points, leftHanded)
  const [leftKey, rightKey] = leftHanded ? (['push', 'pull'] as const) : (['pull', 'push'] as const)
  const aimNote = stats.avgAimDistance != null && !teeShots ? ` You aim it about ${dist(stats.avgAimDistance, unit)} on average.` : ''
  const startWords = (() => {
    const w = tallyWords(start, SHOT_START_LINE_LABELS, n)
    if (start.recorded === 0) return w
    return { ...w, note: `${w.note}. Starts right of your aim on ${start.counts[rightKey]}, left on ${start.counts[leftKey]}` }
  })()
  const practiceWords = `Practise it: ${CATEGORY_LABEL[practice].toLowerCase()} drills`

  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 6 }}>
        <Tile label="68% of shots" value={pair(stats.cone68.lateral * 2, stats.cone68.distance * 2)} note="wide × short to long" />
        {finish != null ? (
          <Tile
            label="Finishes"
            value={`${num(finish - stats.cone68.distance, unit)}–${num(finish + stats.cone68.distance, unit)} ${u}`}
            note="68% of shots, from where it was hit"
          />
        ) : (
          <Tile label="Typical distance" value={typicalYards != null ? dist(typicalYards, unit) : '—'} note="how far it goes, every lie" />
        )}
      </View>
      {finish != null && (
        <Row
          label="Typical distance"
          value={typicalYards != null ? dist(typicalYards, unit) : '—'}
          note={`How far it goes, ${filtered ? 'all lies, not just these' : 'every lie'}.${aimNote}`}
        />
      )}
      <Row label="Shots" value={String(n)} note={shotsNote} />
      <Row
        label={shortMore ? 'Finishes short' : 'Finishes long'}
        value={`${shortMore ? misses.short : misses.long} of ${n}`}
        note={`${shortMore ? `${misses.long} long` : `${misses.short} short`}; ${misses.left} left, ${misses.right} right of the aim`}
      />
      <Row label="95% of shots" value={pair(stats.cone95.lateral * 2, stats.cone95.distance * 2)} note="Wide × deep. The dashed ring." />
      <TallyRow label="Shape" tally={shape} words={tallyWords(shape, SHOT_SHAPE_LABELS, n)} by="shape" leftHanded={leftHanded} onColour={onColour} />
      <TallyRow label="Start line" tally={start} words={startWords} by="start" leftHanded={leftHanded} onColour={onColour} />
      <Matrix points={points} leftHanded={leftHanded} />
      <PressableTouch
        accessibilityRole="link"
        accessibilityLabel={practiceWords}
        onPress={() => router.push({ pathname: '/(app)/drills', params: { category: practice } } as never)}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderColor: P.line }}
      >
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { flex: 1, fontSize: 15, color: P.ink }]}>{practiceWords}</Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 20, color: P.ink }]}>→</Text>
      </PressableTouch>
      <Key
        accessibilityLabel="Export shot pattern image"
        onPress={onExport}
        disabled={sharing}
        hitSlop={8}
        style={{ alignSelf: 'flex-start', marginTop: 22 }}
        faceStyle={{ flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 16 }}
      >
        <MaterialCommunityIcons name="tray-arrow-down" size={15} color={sharing ? P.ink35 : P.ink} />
        <KeyText size={13} disabled={sharing}>{sharing ? 'Rendering…' : 'Export image'}</KeyText>
      </Key>
    </View>
  )
}
