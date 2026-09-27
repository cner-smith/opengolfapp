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
import { PaperTile } from '../paper/Section'
import { FONT_CAP, P as PAPER, R } from '../paper/tokens'

// ── palette (paper tokens; mute + boxBg have no paper equivalent) ─────────────
export const C = {
  ink: PAPER.ink,
  inkDim: PAPER.inkDim,
  mute: '#8A8B7E',
  line: PAPER.line,
  boxBg: '#EBE5D6',
  surface: PAPER.raised,
  accent: PAPER.forest,
  amber: PAPER.warn,
  bg: PAPER.chrome,
} as const

// ── text styles ───────────────────────────────────────────────────────────
// Paper option B: small labels / eyebrows are sentence-case Epilogue, not mono caps.
export const KICKER: TextStyle = {
  color: C.inkDim,
  fontFamily: FONT.body,
  fontSize: 12,
  lineHeight: 16,
}

export const TITLE: TextStyle = {
  color: C.ink,
  fontFamily: FONT.serifItalic,
  fontSize: 26,
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
  color: C.ink,
  fontFamily: FONT.serifItalic,
  fontSize: 16,
  lineHeight: 22,
  marginTop: 14,
  marginBottom: 8,
}

const H3_STYLE: TextStyle = {
  color: C.ink,
  fontFamily: FONT.serifItalic,
  fontSize: 19,
  lineHeight: 25,
  marginTop: 22,
  marginBottom: 12,
}

const H4_STYLE: TextStyle = {
  color: C.ink,
  fontFamily: FONT.serifItalic,
  fontSize: 16,
  lineHeight: 22,
  marginTop: 16,
  marginBottom: 8,
}

// ── inline spans (nest inside <P>, <H3>, list items, etc.) ──────────────────
export function Strong({ children }: { children: ReactNode }) {
  return <Text maxFontSizeMultiplier={FONT_CAP} style={{ fontFamily: FONT.bodyBold }}>{children}</Text>
}

export function Em({ children }: { children: ReactNode }) {
  return <Text maxFontSizeMultiplier={FONT_CAP} style={{ fontFamily: FONT.bodyItalic }}>{children}</Text>
}

export function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Text
      maxFontSizeMultiplier={FONT_CAP}
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
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...KICKER, marginBottom: 10 }}>{kicker}</Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={TITLE}>{title}</Text>
    </View>
  )
}

export function P({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text maxFontSizeMultiplier={FONT_CAP} style={[BODY, style]}>{children}</Text>
}

export function H3({ children }: { children: ReactNode }) {
  return <Text maxFontSizeMultiplier={FONT_CAP} style={H3_STYLE}>{children}</Text>
}

export function H4({ children }: { children: ReactNode }) {
  return <Text maxFontSizeMultiplier={FONT_CAP} style={H4_STYLE}>{children}</Text>
}

export function Subhead({ children }: { children: ReactNode }) {
  return <Text maxFontSizeMultiplier={FONT_CAP} style={SUBKICKER}>{children}</Text>
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
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...BODY, marginBottom: 0 }}>{'•'}</Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...BODY, marginBottom: 0, flex: 1 }}>{item}</Text>
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
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...BODY, marginBottom: 0, fontFamily: FONT.bodyBold }}>{i + 1}.</Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...BODY, marginBottom: 0, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

/** Paper tile with a left accent rule. tone: 'accent' (green) | 'amber'. */
export function Callout({
  children,
  tone = 'accent',
}: {
  children: ReactNode
  tone?: 'accent' | 'amber'
}) {
  return (
    <PaperTile
      style={{ marginBottom: 16 }}
      innerStyle={{ borderLeftWidth: 4, borderLeftColor: tone === 'amber' ? C.amber : C.accent }}
    >
      {children}
    </PaperTile>
  )
}

/** "Glance" paper tile: optional label + arbitrary rows/content. */
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
    // Callers' style (padding, fills from before the paper tiles) belongs on
    // the tile face; on the shadow wrapper it drew a grey slab round the tile.
    <PaperTile
      style={{ marginBottom: 16, marginTop: style?.marginTop }}
      innerStyle={[style, { backgroundColor: PAPER.raised, borderColor: PAPER.ink, borderRadius: R, marginTop: 0 }]}
    >
      {label ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...SUBKICKER, marginTop: 0 }}>
          {label}
        </Text>
      ) : null}
      {children}
    </PaperTile>
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
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 15, marginBottom: 4 }}>
        {term}
      </Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  )
}

/** Inline label + body paragraph (web "Kv"). */
export function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={FONT_CAP} style={BODY}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ fontFamily: FONT.bodyBold }}>{label} </Text>
      {children}
    </Text>
  )
}

/** Outlined paper tag (a label, not a button). */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <Text
      maxFontSizeMultiplier={FONT_CAP}
      style={{
        ...KICKER,
        color: C.accent,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.ink,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: R,
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
        <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...KICKER, marginTop: 8, textAlign: 'center' }}>
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
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...SUBKICKER, marginTop: 0, marginBottom: 4 }}>Sources</Text>
      {items.map((s, i) => (
        <View key={i} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 14, marginBottom: 3 }}>
            {s.href ? <Link href={s.href}>{s.name}</Link> : s.name}
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 13, lineHeight: 19 }}>{s.note}</Text>
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
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 15 }}>
            {r.title}
            {r.by ? <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: C.inkDim, fontFamily: FONT.body }}> — {r.by}</Text> : null}
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{r.note}</Text>
        </View>
      ))}
    </View>
  )
}

/** Dev-only editorial annotation (source citation / TODO). Renders nothing in
 *  production — these are internal review notes, never shown to readers. */
export function DevNote({
  variant,
  inline,
  children,
}: {
  variant: 'research' | 'todo'
  inline?: boolean
  children: ReactNode
}) {
  if (!__DEV__) return null
  const tone = variant === 'research' ? C.accent : C.amber
  const label = variant === 'research' ? 'Source' : 'Todo'
  if (inline) {
    return (
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...KICKER, color: tone, marginTop: 4 }}>
        [{label}] {children}
      </Text>
    )
  }
  return (
    <View
      style={{
        backgroundColor: C.boxBg,
        borderLeftWidth: 3,
        borderLeftColor: tone,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...KICKER, color: tone, marginBottom: 4 }}>{label} · dev only</Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ color: C.inkDim, fontFamily: FONT.bodyItalic, fontSize: 13, lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  )
}

/** Article footer ("Last reviewed … · Draft …"). */
export function ArticleFooter({ children }: { children: ReactNode }) {
  return (
    <Text
      maxFontSizeMultiplier={FONT_CAP}
      style={{
        ...KICKER,
        borderTopWidth: 1,
        borderTopColor: C.line,
        paddingTop: 18,
        marginTop: 22,
      }}
    >
      {children}
    </Text>
  )
}
