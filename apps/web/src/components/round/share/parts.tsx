import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { marksFor, marksPath, type ShareCardModel } from '@oga/core'

// Shared by the five round share card styles (#1437). Every style is a
// renderer only: the words and numbers come from shareCardModel.

export const CARD_W = 540
export const CARD_H = 675

export type ShareTone = 'light' | 'dark'

export const TONES = {
  light: {
    bg: '#FBF8F1',
    surface: '#F2EEE5',
    line: '#D9D2BF',
    strong: '#9F9580',
    ink: '#1C211C',
    dim: '#5C6356',
    mute: '#8A8B7E',
    accent: '#1F3D2C',
    neg: '#A33A2A',
    pencil: '#3A3F37',
  },
  dark: {
    bg: '#1C211C',
    surface: '#242A24',
    line: 'rgba(217,210,191,0.18)',
    strong: 'rgba(217,210,191,0.4)',
    ink: '#F2EEE5',
    dim: 'rgba(242,238,229,0.68)',
    mute: 'rgba(242,238,229,0.48)',
    accent: '#8FB89A',
    neg: '#D87B6E',
    pencil: 'rgba(242,238,229,0.82)',
  },
} as const

export type Tone = (typeof TONES)[ShareTone]

export interface StyleProps {
  model: ShareCardModel
  tone: ShareTone
}

export const SERIF = '"Fraunces", Georgia, serif'
export const SANS = 'Epilogue, system-ui, sans-serif'
export const HAND = 'Kalam, cursive'
export const MONO = 'Inconsolata, monospace'

export const serif: CSSProperties = { fontFamily: SERIF, fontVariantNumeric: 'lining-nums tabular-nums' }

// The rasteriser embeds only the fonts its HTML elements name (it does not
// look inside an svg), so the card names every family the styles draw with.
// Self-contained inline styles: no stylesheet lookups at capture time.
export function Card({ c, children }: { c: Tone; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
        background: c.bg,
        color: c.ink,
        fontFamily: SANS,
        padding: '30px 30px 24px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        textAlign: 'left',
        lineHeight: 'normal',
      }}
    >
      <div aria-hidden style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <span style={{ fontFamily: SERIF }}>a</span>
        <span style={{ fontFamily: SERIF, fontStyle: 'italic' }}>a</span>
        <span style={{ fontFamily: HAND }}>a</span>
        <span style={{ fontFamily: MONO }}>a</span>
      </div>
      {children}
    </div>
  )
}

export function Dateline({ model, c }: { model: ShareCardModel; c: Tone }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: c.dim,
        fontWeight: 500,
      }}
    >
      {model.dateline}
    </div>
  )
}

export function Course({ model, size = 30, italic, style }: { model: ShareCardModel; size?: number; italic?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: SERIF,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: '-0.005em',
        fontStyle: italic ? 'italic' : 'normal',
        ...style,
      }}
    >
      {model.course}
    </div>
  )
}

export function TeeLine({ model, c, style }: { model: ShareCardModel; c: Tone; style?: CSSProperties }) {
  if (!model.teeLine) return null
  return <div style={{ fontSize: 13, color: c.dim, marginTop: 7, ...style }}>{model.teeLine}</div>
}

export function Foot({ c, style }: { c: Tone; style?: CSSProperties }) {
  return (
    <div
      style={{
        marginTop: 26,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingTop: 12,
        borderTop: `1px solid ${c.line}`,
        fontSize: 12,
        color: c.mute,
        ...style,
      }}
    >
      <span>Free, open source golf tracking</span>
      <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 17, color: c.ink }}>
        oga<b style={{ fontStyle: 'normal', color: c.accent, fontWeight: 500 }}>.</b>golf
      </span>
    </div>
  )
}

/** A hole's pencil mark (none at par), centred at x, y inside an svg. */
export function Mark({ toPar, seed, x, y, scale, fill }: { toPar: number; seed: number; x: number; y: number; scale: number; fill: string }) {
  const d = useMemo(() => marksPath(marksFor(toPar, seed), 1e9), [toPar, seed])
  if (!d) return null
  return <path d={d} fill={fill} transform={`translate(${x} ${y}) scale(${scale})`} />
}

/** "front nine" / "back nine" for a partial round that played one nine. */
export const nineName = (model: ShareCardModel) => (model.playedNine ? `${model.playedNine} nine` : null)
