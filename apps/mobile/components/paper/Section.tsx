import type { ReactNode } from 'react'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { TYPE } from '../../lib/typography'
import { HardShadow } from './Paper'
import { FONT_CAP, P, R } from './tokens'

// Paper section head (Home / Stats / Patterns / Practice / Bag / Profile): one
// ink rule, then a Fraunces-italic title — replaces the mono-caps kickers.
export function SectionHead({ title, trailing, style }: { title: string; trailing?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { borderTopWidth: 1, borderColor: P.ink, paddingTop: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
        style,
      ]}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { flex: 1, fontSize: 20, lineHeight: 26, color: P.ink }]}>
        {title}
      </Text>
      {trailing}
    </View>
  )
}

// A raised paper card: 1 ink border, radius 3, 2/2 hard shadow.
export function PaperTile({ children, style, innerStyle }: { children: ReactNode; style?: StyleProp<ViewStyle>; innerStyle?: StyleProp<ViewStyle> }) {
  return (
    <HardShadow style={style}>
      <View style={[{ backgroundColor: P.raised, borderWidth: 1, borderColor: P.ink, borderRadius: R, padding: 14 }, innerStyle]}>{children}</View>
    </HardShadow>
  )
}

// Stat tile: sentence-case label over a Fraunces figure.
export function StatTile({ label, value, valueColor = P.ink, style }: { label: string; value: string; valueColor?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <PaperTile style={style}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 6 }]}>{label}</Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: valueColor, fontSize: 30, lineHeight: 36 }]}>{value}</Text>
    </PaperTile>
  )
}
