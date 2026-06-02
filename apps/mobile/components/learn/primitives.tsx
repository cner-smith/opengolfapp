/**
 * Shared rendering primitives for mobile Learn articles.
 *
 * Mobile mirrors the web Learn articles (apps/web/src/pages/learn/articles/*),
 * which hand-roll near-identical H3/P/Hr/Callout/Sources/Footer components in
 * every file. Rather than re-duplicate that boilerplate across 20 RN article
 * files, the repeating pieces live here once (well over the 3-caller bar) and
 * each article file composes them. Article-specific one-offs (a card grid only
 * one article uses) stay co-located in that article's file.
 *
 * Inline emphasis uses nested <Text>: write `<P>plain <Strong>bold</Strong></P>`
 * — RN flows nested Text inline just like the web <strong>/<em> spans. Nested
 * Text inherits the parent's fontFamily, so spans only override when the weight
 * or style changes (Strong/Em).
 *
 * Fonts come from the single mobile type source (lib/typography FONT); never
 * hardcode a family string here.
 */
import type { ReactNode } from 'react'
import { Linking, Text, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'
import { FONT } from '../../lib/typography'

// ── palette (matches web tokens + the existing mobile [article].tsx) ──────────
export const C = {
  ink: '#1C211C',
  inkDim: '#5C6356',
  mute: '#8A8B7E',
  line: '#D9D2BF',
  boxBg: '#EBE5D6',
  surface: '#FBF8F1',
  accent: '#1F3D2C',
  amber: '#A66A1F',
  bg: '#F2EEE5',
} as const

// ── text styles ───────────────────────────────────────────────────────────
export const KICKER: TextStyle = {
  color: C.mute,
  fontFamily: FONT.mono,
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export const TITLE: TextStyle = {
  color: C.ink,
  fontFamily: FONT.serifItalic,
  fontSize: 26,
  fontStyle: 'italic',
  fontWeight: '500',
  lineHeight: 32,
  marginBottom: 14,
}

export const BODY: TextStyle = {
  color: C.ink,
  fontFamily: FONT.body,
  fontSize: 15,
  lineHeight: 22,
  marginBottom: 14,
}

export const SUBKICKER: TextStyle = {
  ...KICKER,
  color: C.inkDim,
  marginTop: 14,
  marginBottom: 10,
}

const H3_STYLE: TextStyle = {
  color: C.ink,
  fontFamily: FONT.serifItalic,
  fontSize: 19,
  fontStyle: 'italic',
  fontWeight: '500',
  lineHeight: 25,
  marginTop: 22,
  marginBottom: 12,
}

const H4_STYLE: TextStyle = {
  color: C.ink,
  fontFamily: FONT.serifItalic,
  fontSize: 16,
  fontStyle: 'italic',
  fontWeight: '500',
  lineHeight: 22,
  marginTop: 16,
  marginBottom: 8,
}

// ── inline spans (nest inside <P>, <H3>, list items, etc.) ──────────────────
export function Strong({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: FONT.bodyBold, fontWeight: '700' }}>{children}</Text>
}

export function Em({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: FONT.bodyItalic, fontStyle: 'italic' }}>{children}</Text>
}

export function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Text
      style={{ color: C.accent, textDecorationLine: 'underline' }}
      onPress={() => Linking.openURL(href)}
    >
      {children}
    </Text>
  )
}

// ── block primitives ────────────────────────────────────────────────────────
export function ArticleHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>{kicker}</Text>
      <Text style={TITLE}>{title}</Text>
    </View>
  )
}

export function P({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[BODY, style]}>{children}</Text>
}

export function H3({ children }: { children: ReactNode }) {
  return <Text style={H3_STYLE}>{children}</Text>
}

export function H4({ children }: { children: ReactNode }) {
  return <Text style={H4_STYLE}>{children}</Text>
}

export function Subhead({ children }: { children: ReactNode }) {
  return <Text style={SUBKICKER}>{children}</Text>
}

export function Hr() {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line, marginVertical: 18 }} />
  )
}

/** Plain disc bullet list. Each item may contain inline spans. */
export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <View style={{ marginBottom: 14, marginTop: 2 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <Text style={{ ...BODY, marginBottom: 0 }}>{'•'}</Text>
          <Text style={{ ...BODY, marginBottom: 0, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

/** Numbered (ordered) list. */
export function NumberList({ items }: { items: ReactNode[] }) {
  return (
    <View style={{ marginBottom: 14, marginTop: 2 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <Text style={{ ...BODY, marginBottom: 0, fontFamily: FONT.bodyBold, fontWeight: '600' }}>{i + 1}.</Text>
          <Text style={{ ...BODY, marginBottom: 0, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

/** Left-accent callout box. tone: 'accent' (green) | 'amber'. */
export function Callout({
  children,
  tone = 'accent',
}: {
  children: ReactNode
  tone?: 'accent' | 'amber'
}) {
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: tone === 'amber' ? C.amber : C.accent,
        backgroundColor: C.boxBg,
        padding: 14,
        marginBottom: 14,
        borderRadius: 2,
      }}
    >
      {children}
    </View>
  )
}

/** Tinted "glance" box: optional small-caps label + arbitrary rows/content. */
export function GlanceBox({
  label,
  children,
  style,
}: {
  label?: string
  children: ReactNode
  style?: ViewStyle
}) {
  return (
    <View
      style={[
        { backgroundColor: C.boxBg, padding: 14, marginBottom: 14, borderRadius: 2 },
        style,
      ]}
    >
      {label ? <Text style={{ ...KICKER, color: C.inkDim, marginBottom: 8 }}>{label}</Text> : null}
      {children}
    </View>
  )
}

/** Definition-style row: italic term + description. Used in glance boxes,
 *  glossary terms, the Bullet primitive, etc. `first` drops the top border. */
export function DefRow({
  term,
  children,
  first,
}: {
  term: ReactNode
  children: ReactNode
  first?: boolean
}) {
  return (
    <View
      style={{
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: C.line,
      }}
    >
      <Text style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 15, fontStyle: 'italic', fontWeight: '500', marginBottom: 4 }}>
        {term}
      </Text>
      <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  )
}

/** Inline label + body paragraph (web "Kv"). */
export function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Text style={BODY}>
      <Text style={{ fontFamily: FONT.bodyBold, fontWeight: '700' }}>{label} </Text>
      {children}
    </Text>
  )
}

/** Small-caps pill tag. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        ...KICKER,
        color: C.accent,
        backgroundColor: C.boxBg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {children}
    </Text>
  )
}

/** Figure wrapper — centers an svg/diagram with an optional caption. */
export function Figure({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 16, marginTop: 4 }}>
      <View
        style={{
          backgroundColor: C.boxBg,
          borderRadius: 2,
          paddingVertical: 18,
          paddingHorizontal: 14,
          alignItems: 'center',
        }}
      >
        {children}
      </View>
      {caption ? (
        <Text style={{ ...KICKER, color: C.mute, marginTop: 8, textAlign: 'center' }}>
          {caption}
        </Text>
      ) : null}
    </View>
  )
}

/** External-source list (web "Sources"): each item a name + note, optional link. */
export function Sources({
  items,
}: {
  items: { name: string; note: ReactNode; href?: string }[]
}) {
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ ...KICKER, marginBottom: 4 }}>Sources</Text>
      {items.map((s, i) => (
        <View key={i} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
          <Text style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 14, fontStyle: 'italic', fontWeight: '500', marginBottom: 3 }}>
            {s.href ? <Link href={s.href}>{s.name}</Link> : s.name}
          </Text>
          <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 13, lineHeight: 19 }}>{s.note}</Text>
        </View>
      ))}
    </View>
  )
}

/** Resource list (web "ResourceList"): {title, by?, note} entries. */
export function ResourceList({
  items,
}: {
  items: { title: string; by?: string; note: ReactNode }[]
}) {
  return (
    <View style={{ marginVertical: 6 }}>
      {items.map((r, i) => (
        <View key={i} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line }}>
          <Text style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 15, fontStyle: 'italic', fontWeight: '500' }}>
            {r.title}
            {r.by ? <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontStyle: 'normal', fontWeight: '400' }}> — {r.by}</Text> : null}
          </Text>
          <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{r.note}</Text>
        </View>
      ))}
    </View>
  )
}

/** Article footer ("Last reviewed … · Draft …"). */
export function ArticleFooter({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        ...KICKER,
        color: C.mute,
        borderTopWidth: 1,
        borderTopColor: C.line,
        paddingTop: 18,
        marginTop: 22,
        lineHeight: 16,
      }}
    >
      {children}
    </Text>
  )
}
