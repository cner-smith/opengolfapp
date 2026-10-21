import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { COLOUR_BY, type ColourBy, type Glyph, type Layer } from '../layers'
import { Marker } from './chartParts'

// The chart's controls. A layer shows or hides one kind of mark; a legend
// entry shows or hides one group of shots; "Colour by" picks the groups. Each
// toggle says what it hides to a screen reader as well as in its tooltip.

const INK = '#1C211C'
const FOREST = '#1F3D2C'
export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-caddie-accent'

export const LAYER_INFO: Record<Layer, { label: string; hides: string }> = {
  shots: { label: 'Shots', hides: 'the mark where each shot finished' },
  rings: { label: 'Rings', hides: 'the two rings (two shots in three, and nearly all)' },
  average: { label: 'Average', hides: 'the average finish and its line from the aim' },
  flights: { label: 'Flights', hides: 'the line of each shot from where it was hit' },
}

/** Arrow / Home / End for a radio group or tab list: the index to move to. */
export function rovingKey(e: KeyboardEvent, i: number, n: number): number | null {
  const j =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? (i + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? (i - 1 + n) % n
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? n - 1
            : null
  if (j == null) return null
  e.preventDefault()
  ;(e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus()
  return j
}

function LayerGlyph({ layer, compact }: { layer: Layer; compact?: boolean }) {
  const c = layer === 'rings' || layer === 'average' ? FOREST : INK
  return (
    <svg width={compact ? 16 : 20} height={compact ? 11 : 14} viewBox="0 0 20 14" fill="none" aria-hidden className="pat-glyph" style={{ flex: 'none' }}>
      {layer === 'rings' && (
        <>
          <ellipse cx="10" cy="7" rx="9" ry="6" stroke={c} strokeDasharray="2.5 2" />
          <ellipse cx="10" cy="7" rx="5" ry="3.4" stroke={c} strokeWidth={1.3} fill="rgba(31,61,44,0.1)" />
        </>
      )}
      {layer === 'average' && (
        <>
          <path d="M3 12 L13 4" stroke={INK} strokeDasharray="2 2" />
          <circle cx="14" cy="4" r="3" fill="#FBF8F1" stroke={c} strokeWidth={1.6} />
        </>
      )}
      {layer === 'shots' && (
        <>
          <circle cx="5" cy="9" r="2.4" fill={c} />
          <circle cx="11" cy="4.5" r="2.4" fill={c} />
          <circle cx="15.5" cy="10" r="2.4" fill={c} />
        </>
      )}
      {layer === 'flights' && <path d="M4 13 C4 6 8 2 16 1.5" stroke={c} strokeWidth={1.4} strokeLinecap="round" />}
    </svg>
  )
}

function Toggle({ on, onClick, hint, children, onHover, compact, disabled }: {
  compact?: boolean
  on: boolean
  disabled?: boolean
  onClick: () => void
  hint: string
  children: ReactNode
  onHover?: (enter: boolean) => void
}) {
  const id = useId()
  const live = on && !disabled
  return (
    <>
    <button
      type="button"
      aria-pressed={live}
      aria-disabled={disabled || undefined}
      aria-describedby={id}
      title={hint}
      onClick={disabled ? undefined : onClick}
      onPointerEnter={onHover && ((e) => e.pointerType === 'mouse' && onHover(true))}
      onPointerLeave={onHover && (() => onHover(false))}
      onFocus={onHover && (() => onHover(true))}
      onBlur={onHover && (() => onHover(false))}
      className={`pat-tap ${FOCUS_RING} ${disabled ? '' : 'hover:border-caddie-line-strong'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        minHeight: compact ? 36 : 32,
        padding: compact ? '5px 8px 5px 7px' : '5px 10px 5px 8px',
        borderRadius: 2,
        border: live ? '1px solid #9F9580' : disabled ? '1px dashed #D9D2BF' : '1px dashed #8A8B7E',
        background: live ? '#EBE5D6' : 'transparent',
        color: live ? INK : '#5C6356',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background-color 150ms ease',
      }}
    >
      <span style={{ display: 'inline-flex' }}>{children}</span>
    </button>
    <span id={id} className="sr-only">{hint}</span>
    </>
  )
}

export function LayerBar({ layers, available, disabled, onToggle, compact }: {
  compact?: boolean
  layers: Record<Layer, boolean>
  available: Layer[]
  /** Shown but off until there is a pattern (five shots). */
  disabled: Set<Layer>
  onToggle: (l: Layer) => void
}) {
  return (
    <div role="group" aria-label="Show on the chart" className="flex flex-wrap" style={{ gap: 6 }}>
      {available.map((l) => {
        const on = layers[l]
        const off = disabled.has(l)
        const hint = off ? `${LAYER_INFO[l].label}: needs five shots` : `${on ? 'Hides' : 'Shows'} ${LAYER_INFO[l].hides}`
        return (
          <Toggle key={l} compact={compact} on={on} disabled={off} onClick={() => onToggle(l)} hint={hint}>
            <span className="inline-flex items-center" style={{ gap: compact ? 5 : 7 }}>
              <LayerGlyph layer={l} compact={compact} />
              <span>{LAYER_INFO[l].label}</span>
            </span>
          </Toggle>
        )
      })}
    </div>
  )
}

export function ColourByControl({ value, onChange, compact }: { value: ColourBy; onChange: (v: ColourBy) => void; compact?: boolean }) {
  const i = COLOUR_BY.findIndex((o) => o.value === value)
  return (
    <div className="flex items-center flex-wrap" style={{ gap: compact ? 8 : 10 }}>
      <span className="text-caddie-ink-dim" style={{ fontSize: 13 }} aria-hidden>Colour</span>
      <div role="radiogroup" aria-label="Colour the shots by" className="flex" style={{ gap: compact ? 12 : 14 }}>
        {COLOUR_BY.map((o, j) => {
          const on = j === i
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => {
                const k = rovingKey(e, j, COLOUR_BY.length)
                if (k != null) onChange(COLOUR_BY[k]!.value)
              }}
              className={`pat-tap ${FOCUS_RING}`}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: on ? `2px solid ${INK}` : '2px solid transparent',
                minHeight: 32,
                padding: '4px 0 3px',
                fontSize: 13,
                fontWeight: on ? 600 : 400,
                color: on ? INK : '#5C6356',
                cursor: 'pointer',
              }}
            >
              {compact ? o.short : o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export interface LegendEntry {
  key: string
  label: string
  color: string
  glyph: Glyph
  count: number
}

export function Legend({ entries, hidden, focus, onToggle, onFocus, note }: {
  entries: LegendEntry[]
  hidden: Set<string>
  focus: string | null
  onToggle: (k: string) => void
  onFocus: (k: string | null) => void
  note: string
}) {
  // On touch there is no hover: the first tap steps the others back, the second hides.
  const touch = useRef(false)
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  return (
    <div>
      <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
        <span className="text-caddie-ink-dim" style={{ fontSize: 13, marginRight: 4 }} aria-hidden>Show</span>
        <div role="group" aria-label="Show or hide groups of shots" className="flex flex-wrap" style={{ gap: 6 }}>
          {entries.map((e) => {
            const on = !hidden.has(e.key)
            const noun = `${e.count} ${e.label.toLowerCase()} shot${e.count === 1 ? '' : 's'}`
            return (
              <span key={e.key} onPointerDown={(ev) => (touch.current = ev.pointerType !== 'mouse')}>
                <Toggle
                  on={on}
                  onClick={() => {
                    if (touch.current && on && focus !== e.key) return onFocus(e.key)
                    onToggle(e.key)
                    if (touch.current) onFocus(null)
                  }}
                  onHover={(enter) => onFocus(enter && on ? e.key : null)}
                  hint={`${on ? 'Hides' : 'Shows'} the ${noun}`}
                >
                  <span className="inline-flex items-center" style={{ gap: 7 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="pat-glyph">
                      <Marker x={6} y={6} r={4} glyph={e.glyph} color={e.color} />
                    </svg>
                    <span>{e.label}</span>
                    <span className="font-serif tabular" style={{ fontSize: 14 }}>{e.count}</span>
                  </span>
                </Toggle>
              </span>
            )
          })}
        </div>
      </div>
      <div className="text-caddie-ink-dim" style={{ fontSize: 13, lineHeight: 1.45, marginTop: 8 }}>
        {note} {coarse ? 'Tap a group once to bring it forward, twice to hide it.' : 'Click a group to hide it.'}
      </div>
    </div>
  )
}
