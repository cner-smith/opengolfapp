import type { ReactNode } from 'react'
import { Pressable, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import {
  SHOT_CONTACT_LABELS,
  SHOT_CONTACTS,
  SHOT_SHAPE_LABELS,
  SHOT_SHAPES,
  SHOT_START_LINE_LABELS,
  SHOT_START_LINES,
  type LieSlopeForward,
  type LieSlopeSide,
  type ShotContact,
  type ShotResultAxes,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import { useUnitsContext } from '../../contexts/UnitsContext'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, Rocker } from './Paper'
import { FONT_CAP, GAP, P, R } from './tokens'

// Choose-one pickers (#611 §19.9 "P2: grouped rockers"), shared by the live
// hole-review sheet and the past-round edit sheet.

// ≥ 1.15× font scale moves each row's label above its rocker so 5-segment
// rows still fit.
export function useStackedLabels() {
  return useWindowDimensions().fontScale >= 1.15
}

// A group label (Epilogue 12, 52 wide) left of its control, or above it at
// large text.
export function PickerRow({ label, stacked, children }: { label: string; stacked: boolean; children: ReactNode }) {
  return stacked ? (
    <View>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, color: P.ink, marginBottom: 3 }]}>{label}</Text>
      {children}
    </View>
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { width: 60, fontSize: 12, color: P.ink }]}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

export interface Opt<T extends string> {
  value: T
  label: string
}

// A field head: Fraunces-italic label, then its rows.
export function PickerField({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: P.line, gap: 7 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 16, color: P.ink }]}>{title}</Text>
      {children}
    </View>
  )
}

const MAX_PER_ROW = 5

// Balanced rows, never one segment left over: ceil(n / rows) each.
function splitRows<T>(items: T[]): T[][] {
  if (items.length <= MAX_PER_ROW) return [items]
  const rows = Math.ceil(items.length / MAX_PER_ROW)
  const per = Math.ceil(items.length / rows)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per))
  return out
}

// A rocker split into balanced rows when it's wide, with an optional row
// label (omit it when the field title already names the choice: Lie,
// Result). Tapping the active segment clears it (every axis is nullable).
export function RockerRows<T extends string>({
  label,
  options,
  value,
  onChange,
  stacked = false,
}: {
  label?: string
  options: Opt<T>[]
  value: T | null
  onChange: (v: T | null) => void
  stacked?: boolean
}) {
  return (
    <>
      {splitRows(options).map((row, i) => {
        const rocker = <Rocker options={row} value={value} onChange={onChange} clearable fontSize={13.5} />
        return label === undefined ? (
          <View key={i}>{rocker}</View>
        ) : (
          <PickerRow key={i} label={i === 0 ? label : ''} stacked={stacked && i === 0}>
            {rocker}
          </PickerRow>
        )
      })}
    </>
  )
}

const WOOD = /^(driver|\d+w|\d+h)$/
const IRON = /^\d+i$/

// Club picker (§19.9): Woods (driver, woods and hybrids) · Irons · Wedges (and
// putter). A group never renders as one lonely segment — it folds into its
// neighbour.
export function ClubPicker({
  clubs,
  value,
  onChange,
}: {
  /** The bag in formatClubLabel order, labels already formatted. */
  clubs: Opt<string>[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  const stacked = useStackedLabels()
  const groups: { label: string; opts: Opt<string>[] }[] = [
    { label: 'Woods', opts: clubs.filter((c) => WOOD.test(c.value)) },
    { label: 'Irons', opts: clubs.filter((c) => IRON.test(c.value)) },
    { label: 'Wedges', opts: clubs.filter((c) => !WOOD.test(c.value) && !IRON.test(c.value)) },
  ].filter((g) => g.opts.length > 0)
  for (let i = 0; i < groups.length && groups.length > 1; i++) {
    const g = groups[i]!
    if (g.opts.length !== 1) continue
    const into = groups[i + 1] ?? groups[i - 1]!
    into.opts = i + 1 < groups.length ? [...g.opts, ...into.opts] : [...into.opts, ...g.opts]
    groups.splice(i, 1)
    i--
  }
  return (
    <>
      {groups.map((g) => (
        <RockerRows key={g.label} label={g.label} options={g.opts} value={value} onChange={onChange} stacked={stacked} />
      ))}
    </>
  )
}

const FORWARD: { value: LieSlopeForward; label: string }[] = [
  { value: 'uphill', label: 'Uphill' },
  { value: 'level', label: 'Level' },
  { value: 'downhill', label: 'Downhill' },
]

function SlopeGlyph({ kind, bold }: { kind: LieSlopeForward | LieSlopeSide; bold: boolean }) {
  const s = { stroke: P.ink, strokeWidth: bold ? 2 : 1.5, strokeLinecap: 'round' as const }
  const [x1, y1, x2, y2, cx, cy] = {
    uphill: [4, 18, 28, 6, 6, 15],
    level: [4, 16, 28, 16, 16, 12],
    downhill: [4, 6, 28, 18, 26, 15],
    ball_above: [4, 18, 28, 18, 16, 8],
    ball_below: [4, 8, 28, 8, 16, 18],
  }[kind]
  return (
    <Svg width={32} height={24} viewBox="0 0 32 24">
      <Line x1={x1} y1={y1} x2={x2} y2={y2} {...s} />
      <Circle cx={cx} cy={cy} r={2} fill={P.ink} />
    </Svg>
  )
}

// The fixed 3×2 lie-slope grid (DESIGN.md): Uphill | Level | Downhill over
// Ball above | — | Ball below, 46 dp keys with the ground-line glyph. Two
// independent axes; tapping the set key clears its axis.
export function SlopeGrid({
  forward,
  side,
  onForward,
  onSide,
}: {
  forward: LieSlopeForward | null
  side: LieSlopeSide | null
  onForward: (v: LieSlopeForward | null) => void
  onSide: (v: LieSlopeSide | null) => void
}) {
  const cell = (on: boolean, label: string, kind: LieSlopeForward | LieSlopeSide, press: () => void) => (
    <Key key={kind} accessibilityLabel={label} latched={on} onPress={press} style={{ flex: 1 }} faceStyle={{ minHeight: 46, paddingVertical: 3, gap: 1 }}>
      <SlopeGlyph kind={kind} bold={on} />
      <KeyText size={12} bold={on}>
        {label}
      </KeyText>
    </Key>
  )
  return (
    <View style={{ gap: GAP }}>
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {FORWARD.map((f) => cell(forward === f.value, f.label, f.value, () => onForward(forward === f.value ? null : f.value)))}
      </View>
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {cell(side === 'ball_above', 'Ball above', 'ball_above', () => onSide(side === 'ball_above' ? null : 'ball_above'))}
        <View style={{ flex: 1 }} />
        {cell(side === 'ball_below', 'Ball below', 'ball_below', () => onSide(side === 'ball_below' ? null : 'ball_below'))}
      </View>
    </View>
  )
}

// Review-sheet chip (§11): a set value is a raised key, an empty field a
// dashed "+ field" outline, a toggle that's on is latched.
export function Chip({
  label,
  state,
  onPress,
  accessibilityLabel,
}: {
  label: string
  state: 'set' | 'empty' | 'on'
  onPress: () => void
  accessibilityLabel?: string
}) {
  if (state === 'empty') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        hitSlop={4}
        style={{
          minHeight: 36,
          paddingHorizontal: 12,
          justifyContent: 'center',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: P.lineStrong,
          borderRadius: R,
          marginBottom: 3,
        }}
      >
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim }]}>{label}</Text>
      </Pressable>
    )
  }
  return (
    <Key
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      latched={state === 'on'}
      hitSlop={4}
      faceStyle={{ minHeight: 36, paddingHorizontal: 12 }}
    >
      <KeyText size={13} bold={state === 'on'}>
        {label}
      </KeyText>
    </Key>
  )
}

// Result glyphs (§19.10), viewBox 28×18. `on` thickens the stroke.
const STRIKE_MARK: Record<ShotContact, string> = {
  solid: 'M9 13.5 L12 11',
  fat: 'M3 16 Q6 13 10 15',
  thin: 'M8 9.5 H12',
  topped: 'M9 5 L13 6.5',
  shank: 'M20 12 L24 6',
}
function StrikeGlyph({ kind, on }: { kind: ShotContact; on: boolean }) {
  const sw = on ? 1.8 : 1.4
  return (
    <Svg width={28} height={18} viewBox="0 0 28 18">
      <Path d="M1 14 H27" stroke={P.ink} strokeWidth={sw} />
      <Circle cx={16} cy={9.5} r={4.2} fill={P.raised} stroke={P.ink} strokeWidth={sw} />
      <Path d={STRIKE_MARK[kind]} stroke={P.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </Svg>
  )
}
const SHAPE_BEND: Record<ShotShape, number> = { hook: -9, draw: -4.5, straight: 0, fade: 4.5, slice: 9 }
// Both glyphs start at the ball and lean to one side, so they're shifted by
// half their lean to sit centred in the key (Slice / Hook read off-centre).
function FlightGlyph({ b, on }: { b: number; on: boolean }) {
  return (
    <Svg width={28} height={18} viewBox={`${b / 2} 0 28 18`}>
      <Circle cx={14} cy={16} r={1.8} fill={P.ink} />
      <Path d={`M14 15 Q${14 - b * 0.2} 8 ${14 + b} 2`} fill="none" stroke={P.ink} strokeWidth={on ? 2 : 1.5} strokeLinecap="round" />
      <Path d="M14 1v3" stroke={P.ink35} strokeWidth={1} />
    </Svg>
  )
}
const START_OFF: Record<ShotStartLine, number> = { pull: -7, on_line: 0, push: 7 }
function StartGlyph({ a, on }: { a: number; on: boolean }) {
  return (
    <Svg width={28} height={18} viewBox={`${a / 2} 0 28 18`}>
      <Path d="M14 1 V17" stroke={P.ink35} strokeWidth={1} strokeDasharray="1.5 2" />
      <Circle cx={14} cy={16} r={1.8} fill={P.ink} />
      <Path d={`M14 15 L${14 + a} 3`} stroke={P.ink} strokeWidth={on ? 2 : 1.5} strokeLinecap="round" />
    </Svg>
  )
}

export type ResultValue = ShotResultAxes & { penalty: boolean; ob?: boolean }

/** "solid · draw · on line" — the review chip's label once anything is set. */
export function resultSummary(v: ResultValue): string {
  return [
    v.contact && SHOT_CONTACT_LABELS[v.contact],
    v.shape && SHOT_SHAPE_LABELS[v.shape],
    v.startLine && SHOT_START_LINE_LABELS[v.startLine],
    v.penalty && 'penalty',
    v.ob && 'OB',
  ]
    .filter(Boolean)
    .join(' · ')
    .replace(/[A-Z][a-z]/g, (m) => m.toLowerCase())
}

// Shot result (§19.10 "R5 with the Start row", #951): three optional axes
// as glyph rockers — tap to set, tap again to clear — plus a Penalty stroke
// key (owner pick; penalties had no other way in) and, where the map has no
// OB flow (past round), an Out of bounds key. Nothing is pre-selected.
// Shape / start glyphs mirror for a left-handed player so left stays left.
export function ResultPicker({
  value,
  onChange,
  withOb = false,
  penaltyCountsStroke = false,
}: {
  value: ResultValue
  onChange: (v: ResultValue) => void
  withOb?: boolean
  /** The end-of-hole review adds the stroke to the hole score; say so. */
  penaltyCountsStroke?: boolean
}) {
  const stacked = useStackedLabels()
  // The player's swing (Profile → Plays), not the phone-layout mirror.
  const { playsLeftHanded: lefty } = useUnitsContext()
  const flip = lefty ? -1 : 1
  const shapes = lefty ? [...SHOT_SHAPES].reverse() : SHOT_SHAPES
  const starts = lefty ? [...SHOT_START_LINES].reverse() : SHOT_START_LINES
  const any = value.contact || value.shape || value.startLine || value.penalty || value.ob
  const row = (label: string, rocker: ReactNode) => (
    <PickerRow label={label} stacked={stacked}>
      {rocker}
    </PickerRow>
  )
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: P.line, gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 16, color: P.ink }]}>Result</Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, color: P.inkDim }]}>all optional</Text>
        {any ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear result"
            onPress={() => onChange({ contact: null, shape: null, startLine: null, penalty: false, ob: false })}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={{ marginLeft: 'auto' }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.ink, textDecorationLine: 'underline' }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {row(
        'Contact',
        <Rocker
          options={SHOT_CONTACTS.map((c) => ({
            value: c,
            label: SHOT_CONTACT_LABELS[c],
            icon: (on: boolean) => <StrikeGlyph kind={c} on={on} />,
          }))}
          value={value.contact}
          onChange={(contact) => onChange({ ...value, contact })}
          clearable
          height={48}
          fontSize={13.5}
        />,
      )}
      {row(
        'Shape',
        <Rocker
          options={shapes.map((sh) => ({
            value: sh,
            label: SHOT_SHAPE_LABELS[sh],
            icon: (on: boolean) => <FlightGlyph b={SHAPE_BEND[sh] * flip} on={on} />,
          }))}
          value={value.shape}
          onChange={(shape) => onChange({ ...value, shape })}
          clearable
          height={48}
          fontSize={13.5}
        />,
      )}
      {row(
        'Start',
        <Rocker
          options={starts.map((st) => ({
            value: st,
            label: SHOT_START_LINE_LABELS[st],
            icon: (on: boolean) => <StartGlyph a={START_OFF[st] * flip} on={on} />,
          }))}
          value={value.startLine}
          onChange={(startLine) => onChange({ ...value, startLine })}
          clearable
          height={48}
          fontSize={13.5}
        />,
      )}
      {row(
        '',
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Key
            accessibilityLabel="Penalty stroke"
            latched={value.penalty}
            onPress={() => onChange({ ...value, penalty: !value.penalty })}
            style={{ flex: 1 }}
            faceStyle={{ minHeight: 44 }}
          >
            <KeyText size={13.5} bold={value.penalty}>
              Penalty stroke
            </KeyText>
          </Key>
          {withOb && (
            <Key
              accessibilityLabel="Out of bounds"
              latched={!!value.ob}
              onPress={() => onChange({ ...value, ob: !value.ob })}
              style={{ flex: 1 }}
              faceStyle={{ minHeight: 44 }}
            >
              <KeyText size={13.5} bold={!!value.ob}>
                Out of bounds
              </KeyText>
            </Key>
          )}
        </View>,
      )}
      {penaltyCountsStroke ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12.5, color: P.inkDim, textAlign: 'center' }]}>
          {value.penalty ? 'One stroke added to the hole score.' : 'Adds one stroke to the hole score.'}
        </Text>
      ) : null}
    </View>
  )
}
