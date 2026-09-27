import type { ReactNode } from 'react'
import { Pressable, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'
import type { LieSlopeForward, LieSlopeSide } from '@oga/core'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, Rocker } from './Paper'
import { GAP, P, R } from './tokens'

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
      <Text style={[TYPE.body, { fontSize: 12, color: P.ink, marginBottom: 3 }]}>{label}</Text>
      {children}
    </View>
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={[TYPE.body, { width: 52, fontSize: 12, color: P.ink }]}>{label}</Text>
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
      <Text style={[TYPE.serif, { fontSize: 16, color: P.ink }]}>{title}</Text>
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
        <Text style={[TYPE.body, { fontSize: 13, color: P.inkDim }]}>{label}</Text>
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
