import { useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import Svg, { Text as SvgText } from 'react-native-svg'
import { FONT, TYPE } from '../../lib/typography'
import { P } from './tokens'

// Glyph ascents / em of the BUNDLED fonts (canvas actualBoundingBoxAscent on
// assets/fonts).
const DIGIT_ASC = 0.66
const DEC_ASC = 0.65
const MONO_ASC = 0.69
const CAP_ASC = 0.69

const S = 54
const DS = 17
const US = 13
const CS = 11
const LS = -1.5
const numStyle = [TYPE.serif, { position: 'absolute' as const, left: 0, top: 0, fontSize: S, letterSpacing: LS, color: P.ink }]

// F5g "flush rectangle" hero (§3.1): the number and its [.4 / unit / caption]
// column form one box — column top on the digit top, caption baseline on the
// digit baseline. The number is RN <Text>, measured on device (react-native-svg
// renders Fraunces wider than its metrics on Android, so an SVG number can't be
// trusted to advance where computed); the column is SVG text at baselines
// computed from that measured line.
function HeroNumber({ value, unit }: { value: string; unit: string }) {
  const [whole = '', dec] = value.split('.')
  const [m, setM] = useState<{ w: number; base: number } | null>(null)
  const top = m ? m.base - DIGIT_ASC * S : 0
  const decY = top + DEC_ASC * DS
  const capY = m?.base ?? 0
  const unitY =
    dec !== undefined
      ? decY + (capY - CAP_ASC * CS - decY - MONO_ASC * US) / 2 + MONO_ASC * US
      : top + MONO_ASC * US
  const x0 = (m?.w ?? 0) + 5
  const w = Math.max(152, Math.ceil(x0 + 56))
  return (
    // A wide 3-digit number pushes the column past 152 ("to the pi"), so the
    // box grows to the measured number + the caption.
    <View style={{ width: w, height: m ? Math.ceil(m.base + 3) : 42, opacity: m ? 1 : 0 }}>
      <Text
        allowFontScaling={false}
        onTextLayout={(e) => {
          const l = e.nativeEvent.lines[0]
          if (l) setM({ w: l.width, base: l.y + l.ascender })
        }}
        style={[numStyle, { opacity: 0 }]}
      >
        {whole}
      </Text>
      {/* Android clips an italic glyph at its text layout's edge (shaved the
          top of a trailing 8; paddingRight doesn't help). The trailing space
          widens the drawn layout; the invisible copy above measures x0 without it. */}
      <Text allowFontScaling={false} style={numStyle}>
        {`${whole} `}
      </Text>
      {m && (
        <Svg width={w} height={Math.ceil(m.base + 3)} style={{ position: 'absolute', left: 0, top: 0 }}>
          {dec !== undefined && (
            <SvgText x={x0} y={decY} fill={P.ink} fontFamily={FONT.serifItalic} fontSize={DS}>
              {`.${dec}`}
            </SvgText>
          )}
          <SvgText x={x0} y={unitY} fill={P.ink} fontFamily={FONT.mono} fontSize={US}>
            {unit}
          </SvgText>
          <SvgText x={x0} y={capY} fill={P.ink} fontFamily={FONT.body} fontSize={CS}>
            to the pin
          </SvgText>
        </Svg>
      )}
    </View>
  )
}

// Hero row shared by the live header (§3) and the past-round hole block
// (§19.2): distance to the pin, expected strokes, and an optional trailing
// slot (the live Card key / the past round's hole result).
export function HeroRow({
  distance,
  expected,
  trailing,
  emptyLabel = 'no pin\nset yet',
}: {
  /** Already converted + formatted, e.g. { value: '156.4', unit: 'yd' }; null = no distance. */
  distance: { value: string; unit: string } | null
  expected: number | null
  trailing?: ReactNode
  /** Beside the "—" when there's no distance: why (no pin / no ball). */
  emptyLabel?: string
}) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-end', minHeight: 58, paddingHorizontal: 12, paddingBottom: 8 }}
    >
      <View
        style={{ minWidth: 152, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}
        accessible
        accessibilityLabel={distance ? `${distance.value} ${distance.unit} to the pin` : emptyLabel.replace('\n', ' ')}
      >
        {distance ? (
          <HeroNumber value={distance.value} unit={distance.unit} />
        ) : (
          <>
            <Text
              allowFontScaling={false}
              style={[TYPE.serif, { fontSize: S, lineHeight: S * 0.9, letterSpacing: LS, color: P.ink35 }]}
            >
              —
            </Text>
            <Text allowFontScaling={false} style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink, paddingBottom: 4 }]}>
              {emptyLabel}
            </Text>
          </>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingLeft: 8, paddingRight: 8, paddingBottom: 3 }}>
        <Text allowFontScaling={false} style={[TYPE.serif, { fontSize: 22, lineHeight: 24, color: expected == null ? P.ink35 : P.ink }]}>
          {expected == null ? '—' : expected.toFixed(1)}
        </Text>
        <Text allowFontScaling={false} style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>strokes to hole out</Text>
      </View>
      {trailing}
    </View>
  )
}
