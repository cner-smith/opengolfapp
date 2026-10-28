import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Rocker } from '../../ui/Rocker'

// #611 paper chrome for the web round map, ported from mobile's
// components/paper (HeroRow, PastHoleBlock, PastFooter, Rocker, Key). Tokens
// mirror apps/mobile/components/paper/tokens.ts.
export const P = {
  chrome: '#F2EEE5',
  raised: '#FBF8F1',
  glass: 'rgba(251,248,241,0.68)',
  well: '#E4DCCA',
  ink: '#1C211C',
  inkDim: '#5C6356',
  ink35: 'rgba(28,33,28,.35)',
  line: '#D9D2BF',
  neg: '#A33A2A',
  warn: '#A66A1F',
  graphite: '#3A3D38',
}

// The chrome's grain (mobile tiles a 128 px noise PNG at α ≈ .10): fractal
// noise in an inline SVG, so no asset and no request.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .36 0 0 0 0 .32 0 0 0 0 .26 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='128' height='128' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E\")"

export const chromeSurface: CSSProperties = {
  backgroundColor: P.chrome,
  backgroundImage: GRAIN,
  backgroundSize: '128px 128px',
}

const serif: CSSProperties = { fontFamily: 'var(--caddie-serif)', fontStyle: 'italic', fontWeight: 500 }
const body: CSSProperties = { fontFamily: 'var(--caddie-sans)', fontWeight: 400 }

export const Glyph = {
  prev: (c = P.ink) => (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path d="M12.5 4 L6.5 10 L12.5 16" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  next: (c = P.ink) => (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path d="M7.5 4 L13.5 10 L7.5 16" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: () => (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M9 3 V15 M3 9 H15" stroke={P.ink} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  // The Pattern key's dot ring (mobile Icon.pattern): a scatter in an ellipse.
  pattern: () => (
    <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden>
      <ellipse cx="12" cy="10" rx="10" ry="7.5" fill="none" stroke={P.ink} strokeWidth="1.2" strokeDasharray="2 2" />
      {[
        [12, 10],
        [8, 8],
        [15.5, 7.5],
        [9.5, 12.5],
        [14.5, 12.5],
        [12, 5.5],
        [6, 11],
        [18, 10.5],
      ].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r="1.3" fill={P.ink} />
      ))}
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Hole block (§19.2): ‹ Hole 1 › over "Par 4 · 342 yd · scored 4", then the
// hero row: To the pin from the selected shot, expected strokes, the result.
// ---------------------------------------------------------------------------

export type HoleResult =
  | { scored: true; score: number; toPar: number | null; putts: number | null }
  | { scored: false; shots: number }

export function HoleBlock(p: {
  holeNumber: number
  holeCount: number
  par: number | null
  yardsLabel: string | null
  result: HoleResult
  distance: { value: string; unit: string } | null
  expected: number | null
  onPrev: () => void
  onNext: () => void
}) {
  const sub = [
    p.par != null ? `Par ${p.par}` : null,
    p.yardsLabel,
    p.result.scored ? `scored ${p.result.score}` : 'no score yet',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 50, padding: '0 2px' }}>
        <NavKey label="Previous hole" onClick={p.onPrev} disabled={p.holeNumber <= 1}>
          {Glyph.prev(p.holeNumber <= 1 ? P.ink35 : P.inkDim)}
        </NavKey>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '3px 0' }}>
          <div style={{ ...serif, fontSize: 24, lineHeight: '28px', color: P.ink }}>Hole {p.holeNumber}</div>
          <div style={{ ...body, fontSize: 13, lineHeight: '17px', color: P.ink }}>{sub}</div>
        </div>
        <NavKey label="Next hole" onClick={p.onNext} disabled={p.holeNumber >= p.holeCount}>
          {Glyph.next(p.holeNumber >= p.holeCount ? P.ink35 : P.inkDim)}
        </NavKey>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', minHeight: 58, padding: '0 12px 8px' }}>
        <div
          style={{ minWidth: 152, display: 'flex', alignItems: 'flex-end', gap: 6 }}
          aria-label={p.distance ? `${p.distance.value} ${p.distance.unit} to the pin` : 'No pin set yet'}
          role="img"
        >
          {p.distance ? (
            <HeroNumber value={p.distance.value} unit={p.distance.unit} />
          ) : (
            <>
              <span style={{ ...serif, fontSize: 54, lineHeight: '48px', letterSpacing: -1.5, color: P.ink35 }}>—</span>
              <span style={{ ...body, fontSize: 12, lineHeight: '15px', color: P.ink, paddingBottom: 4 }}>
                no pin
                <br />
                set yet
              </span>
            </>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '0 8px 3px' }}>
          <div style={{ ...serif, fontSize: 22, lineHeight: '24px', color: p.expected == null ? P.ink35 : P.ink }}>
            {p.expected == null ? '—' : p.expected.toFixed(1)}
          </div>
          <div style={{ ...body, fontSize: 12, lineHeight: '15px', color: P.ink }}>strokes to hole out</div>
        </div>
        <ResultCorner result={p.result} />
      </div>
    </div>
  )
}

// Glyph ascents / em, as mobile's HeroRow measured them on the bundled fonts.
const DIGIT_ASC = 0.66
const DEC_ASC = 0.65
const MONO_ASC = 0.69
const CAP_ASC = 0.69
const S = 54
const DS = 17
const US = 13
const CS = 11
const BASE = 40

// F5g "flush rectangle" hero (§3.1): the number and its [.4 / unit / caption]
// column form one box — the column's top on the digit top, the caption's
// baseline on the digit baseline. SVG text, so every baseline is exact.
function HeroNumber({ value, unit }: { value: string; unit: string }) {
  const [whole = '', dec] = value.split('.')
  const ref = useRef<SVGTextElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const measure = () => setW(ref.current?.getComputedTextLength() ?? 0)
    measure()
    void document.fonts?.ready.then(measure)
  }, [whole])
  const top = BASE - DIGIT_ASC * S
  const decY = top + DEC_ASC * DS
  const unitY =
    dec !== undefined
      ? decY + (BASE - CAP_ASC * CS - decY - MONO_ASC * US) / 2 + MONO_ASC * US
      : top + MONO_ASC * US
  const x0 = w + 5
  const width = Math.max(152, Math.ceil(x0 + 56))
  return (
    <svg width={width} height={BASE + 3} style={{ display: 'block', overflow: 'visible', opacity: w ? 1 : 0 }} aria-hidden>
      <text ref={ref} x={0} y={BASE} fill={P.ink} style={{ ...serif, fontSize: S, letterSpacing: -1.5 }}>
        {whole}
      </text>
      {dec !== undefined && (
        <text x={x0} y={decY} fill={P.ink} style={{ ...serif, fontSize: DS }}>
          .{dec}
        </text>
      )}
      <text x={x0} y={unitY} fill={P.ink} style={{ fontFamily: 'var(--caddie-mono)', fontWeight: 500, fontSize: US }}>
        {unit}
      </text>
      <text x={x0} y={BASE} fill={P.ink} style={{ ...body, fontSize: CS }}>
        to the pin
      </text>
    </svg>
  )
}

function ResultCorner({ result }: { result: HoleResult }) {
  const lines = result.scored
    ? [
        result.toPar == null ? null : result.toPar === 0 ? 'E' : result.toPar > 0 ? `+${result.toPar}` : `−${-result.toPar}`,
        result.putts == null ? null : `${result.putts} putt${result.putts === 1 ? '' : 's'}`,
      ].filter(Boolean)
    : [`${result.shots} shot${result.shots === 1 ? '' : 's'}`, 'so far']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginLeft: 6, paddingBottom: 3, flexShrink: 0 }}>
      <div
        style={{
          width: 36,
          height: 36,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...(result.scored ? {} : { border: `1.3px dashed ${P.ink35}` }),
        }}
      >
        <span style={{ ...serif, fontSize: result.scored ? 24 : 20, lineHeight: '30px', color: result.scored ? P.ink : P.ink35 }}>
          {result.scored ? result.score : '—'}
        </span>
        {result.scored && result.toPar != null && <GolfMark toPar={result.toPar} />}
      </div>
      {lines.length > 0 && (
        <div style={{ ...body, fontSize: 12, lineHeight: '15px', color: P.ink, whiteSpace: 'pre' }}>{lines.join('\n')}</div>
      )}
    </div>
  )
}

// Scorecard golf marks (§10): birdie circle, eagle two circles, bogey square,
// double-bogey-or-worse two squares; nothing at par. Graphite, a touch loose,
// like a pencil — a static stand-in for mobile's hand-drawn pencil engine.
function GolfMark({ toPar }: { toPar: number }) {
  if (toPar === 0) return null
  const double = Math.abs(toPar) >= 2
  const stroke = { fill: 'none', stroke: P.graphite, strokeWidth: 1.3, opacity: 0.85 }
  const shapes =
    toPar < 0
      ? [<ellipse key="a" cx="20" cy="19.5" rx="14.5" ry="14" transform="rotate(-8 20 19.5)" {...stroke} />].concat(
          double ? [<ellipse key="b" cx="20" cy="19.5" rx="18" ry="17.6" transform="rotate(6 20 19.5)" {...stroke} />] : [],
        )
      : [<rect key="a" x="6" y="5.5" width="28" height="28" transform="rotate(-2 20 19.5)" {...stroke} />].concat(
          double ? [<rect key="b" x="2.5" y="2" width="35" height="35" transform="rotate(1.5 20 19.5)" {...stroke} />] : [],
        )
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: 'absolute', left: -2, top: -4, overflow: 'visible' }} aria-hidden>
      {shapes}
    </svg>
  )
}

function NavKey({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Footer (§19.5): [‹] "Shot 2 of 5" / summary [›] over [Remove][+ Add shot]
// [Edit shot 2]. Edit is the forest primary: it's the review's main job.
// ---------------------------------------------------------------------------

export function StepperRow({
  pos,
  count,
  summary,
  onPrev,
  onNext,
}: {
  pos: number
  count: number
  summary: string
  onPrev: () => void
  onNext: () => void
}) {
  const square: CSSProperties = { width: 44, height: 44, padding: 0, flexShrink: 0 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 56, gap: 8, padding: '8px 0 9px' }}>
      <button type="button" className="key" aria-label="Previous shot" onClick={onPrev} disabled={pos <= 0} style={square}>
        {Glyph.prev(pos <= 0 ? P.ink35 : P.ink)}
      </button>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <div style={{ ...serif, fontSize: 19, lineHeight: '23px', color: P.ink }}>
          Shot {pos + 1} <span style={{ fontSize: 17 }}>of {count}</span>
        </div>
        <div
          aria-live="polite"
          style={{ ...body, fontSize: 13, lineHeight: '17px', color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {summary}
        </div>
      </div>
      <button
        type="button"
        className="key"
        aria-label="Next shot"
        onClick={onNext}
        disabled={pos >= count - 1}
        style={square}
      >
        {Glyph.next(pos >= count - 1 ? P.ink35 : P.ink)}
      </button>
    </div>
  )
}

// Adding is only offered off the last shot, as on mobile (#593).
export function FooterKeys({
  n,
  isLast,
  busy,
  onRemove,
  onAdd,
  onEdit,
}: {
  n: number
  isLast: boolean
  busy: boolean
  onRemove: () => void
  onAdd: () => void
  onEdit: () => void
}) {
  const label: CSSProperties = { ...body, fontSize: 15, fontWeight: 400, whiteSpace: 'nowrap' }
  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 3 }}>
      <button
        type="button"
        className="key"
        onClick={onRemove}
        disabled={busy}
        aria-label="Remove this shot"
        style={{ ...label, color: busy ? undefined : P.neg, padding: '0 12px' }}
      >
        Remove
      </button>
      {isLast && (
        <button type="button" className="key" onClick={onAdd} disabled={busy} style={{ ...label, padding: '0 12px 0 8px', gap: 6 }}>
          {Glyph.plus()}
          Add shot
        </button>
      )}
      <button
        type="button"
        className="key key-primary"
        onClick={onEdit}
        disabled={busy}
        style={{ flex: 1, minWidth: 0, padding: '0 10px', ...body, fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap' }}
      >
        Edit shot {n}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// On-map keys (§4/§5): the Pattern key bottom-left; the Tee/Appr rocker over
// the glass ruler card on the right.
// ---------------------------------------------------------------------------

export function PatternKey({ active, onToggle, bottom }: { active: boolean; onToggle: () => void; bottom: number }) {
  return (
    <button
      type="button"
      className="key"
      aria-pressed={active}
      onClick={onToggle}
      title="Show your shot pattern"
      style={{
        position: 'absolute',
        left: 12,
        bottom,
        zIndex: 5,
        width: 76,
        height: 56,
        padding: 0,
        flexDirection: 'column',
        gap: 3,
        ...body,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
      }}
    >
      {Glyph.pattern()}
      Pattern
    </button>
  )
}

export function OverlayRail({
  mode,
  onSetMode,
  values,
  unit,
  index,
  onSelect,
  bottom,
}: {
  bottom: number
  mode: 'tee' | 'appr'
  onSetMode: (m: 'tee' | 'appr') => void
  values: readonly number[]
  unit: string
  index: number
  onSelect: (i: number) => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom,
        zIndex: 5,
        width: 112,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        role="group"
        aria-label={mode === 'tee' ? 'Aim width' : 'Aim circle'}
        style={{
          background: P.glass,
          border: `1px solid ${P.ink}`,
          borderRadius: 3,
          padding: '6px 0 4px',
        }}
      >
        <div style={{ ...body, fontStyle: 'italic', fontSize: 12, color: P.ink, textAlign: 'center', paddingBottom: 2 }}>
          {mode === 'tee' ? 'width' : 'circle'}, {unit}
        </div>
        {values.map((v, i) => {
          const on = i === index
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                height: on ? 36 : 28,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: P.ink,
              }}
            >
              {on && (
                <svg width="8" height="12" viewBox="0 0 10 14" aria-hidden>
                  <path d="M0 0 L10 7 L0 14 Z" fill={P.ink} />
                </svg>
              )}
              <span
                style={
                  on
                    ? { ...serif, fontSize: 26, lineHeight: '30px' }
                    : { fontFamily: 'var(--caddie-mono)', fontWeight: 500, fontSize: 14 }
                }
              >
                {v}
              </span>
            </button>
          )
        })}
      </div>
      <Rocker
        label="Overlay"
        options={[
          { value: 'tee', label: 'Tee' },
          { value: 'appr', label: 'Appr' },
        ]}
        value={mode}
        onChange={onSetMode}
      />
    </div>
  )
}
