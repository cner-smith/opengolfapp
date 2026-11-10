import { useMemo, type ReactNode } from 'react'
import { StyleSheet, Text, View, type TextProps, type TextStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { marksFor, marksPath, type ShareCardModel } from '@oga/core'
import { FONT } from '../../../lib/typography'

// Pieces every round share card style (#1437) shares: the 540 × 675 frame
// (4:5, captured at 1080 × 1350), the two inks, the header and the footer.
// Layout numbers follow the design mocks.

export const CARD_W = 540
export const CARD_H = 675
/** The card's inner width (30 dp padding each side). */
export const INNER_W = CARD_W - 60

export type ShareTone = 'light' | 'dark'

export const TONES = {
  light: {
    bg: '#FBF8F1', surface: '#F2EEE5', line: '#D9D2BF', strong: '#9F9580', ink: '#1C211C', dim: '#5C6356',
    mute: '#8A8B7E', accent: '#1F3D2C', neg: '#A33A2A', pencil: '#3A3F37',
  },
  dark: {
    bg: '#1C211C', surface: '#242A24', line: 'rgba(217,210,191,0.18)', strong: 'rgba(217,210,191,0.4)', ink: '#F2EEE5',
    dim: 'rgba(242,238,229,0.68)', mute: 'rgba(242,238,229,0.48)', accent: '#8FB89A', neg: '#D87B6E',
    pencil: 'rgba(242,238,229,0.82)',
  },
} as const

export type Ink = (typeof TONES)[ShareTone]

export interface ShareCardProps {
  model: ShareCardModel
  tone: ShareTone
}

export const NUM: TextStyle = { fontFamily: FONT.serif, fontVariant: ['lining-nums', 'tabular-nums'] }
export const NUM_IT: TextStyle = { fontFamily: FONT.serifItalic, fontVariant: ['lining-nums', 'tabular-nums'] }

// The card is a fixed-size image: the system font size must not reflow it,
// and every line gets an explicit height (Android's default line box for
// these fonts runs taller than the mock's, which pushed the footer off the
// card). Kalam's tall loops need more room than the type fonts.
export function T({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {}
  const lineHeight =
    flat.lineHeight ?? Math.ceil((flat.fontSize ?? 14) * (flat.fontFamily === FONT.hand ? 1.45 : 1.25))
  return <Text allowFontScaling={false} {...rest} style={[style, { lineHeight }]} />
}

export const NINE_NAME = { front: 'Front nine', back: 'Back nine' } as const

export function CardFrame({ c, children }: { c: Ink; children: ReactNode }) {
  return (
    <View
      collapsable={false}
      style={{
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
        backgroundColor: c.bg,
        paddingTop: 30,
        paddingHorizontal: 30,
        paddingBottom: 24,
      }}
    >
      {children}
    </View>
  )
}

export function Kicker({ model, c }: { model: ShareCardModel; c: Ink }) {
  return (
    <T numberOfLines={1} style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1.54, textTransform: 'uppercase', color: c.dim }}>
      {model.dateline}
    </T>
  )
}

export function CourseName({ model, c, size = 30, italic = false }: { model: ShareCardModel; c: Ink; size?: number; italic?: boolean }) {
  return (
    <T
      numberOfLines={2}
      style={{ fontFamily: italic ? FONT.serifItalic : FONT.serif, fontSize: size, lineHeight: Math.round(size * 1.08), color: c.ink, marginTop: 10 }}
    >
      {model.course}
    </T>
  )
}

export function TeeLine({ model, c }: { model: ShareCardModel; c: Ink }) {
  if (!model.teeLine) return null
  return <T numberOfLines={1} style={{ fontFamily: FONT.body, fontSize: 13, color: c.dim, marginTop: 7 }}>{model.teeLine}</T>
}

export function Foot({ c }: { c: Ink }) {
  return (
    <View
      style={{
        marginTop: 26,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: c.line,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}
    >
      <T style={{ fontFamily: FONT.body, fontSize: 12, color: c.mute }}>Free, open source golf tracking</T>
      <T style={{ fontFamily: FONT.serifItalic, fontSize: 17, color: c.ink }}>
        oga<T style={{ fontFamily: FONT.serif, fontSize: 17, color: c.accent }}>.</T>golf
      </T>
    </View>
  )
}

/** A pencil golf mark (core marksFor) centred at x, y, inside a parent Svg. */
export function MarkPath({ toPar, seed, x, y, s, color }: { toPar: number; seed: number; x: number; y: number; s: number; color: string }) {
  const d = useMemo(() => marksPath(marksFor(toPar, seed), 1e9), [toPar, seed])
  if (!d) return null
  return <Path d={d} fill={color} transform={`translate(${x} ${y}) scale(${s})`} />
}

/**
 * A row's pencil marks drawn over its figures. The Svg is padded `pad` dp on
 * every side so a double square isn't clipped (Android Svg clips its box).
 */
export function MarksOverlay({
  marks,
  width,
  height,
  top,
  s,
  color,
  pad = 14,
}: {
  marks: { x: number; toPar: number; seed: number }[]
  width: number
  height: number
  top: number
  s: number
  color: string
  pad?: number
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -pad, top: top - pad }}>
      <Svg width={width + pad * 2} height={height + pad * 2}>
        {marks.map((m) => (
          <MarkPath key={m.seed} toPar={m.toPar} seed={m.seed} x={m.x + pad} y={height / 2 + pad} s={s} color={color} />
        ))}
      </Svg>
    </View>
  )
}
