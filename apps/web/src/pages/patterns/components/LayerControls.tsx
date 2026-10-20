import type { ReactNode } from 'react'
import { COLOUR_BY, type ColourBy, type Layer } from '../layers'

// The chart's layer bar and its legend (direction D). Both are rows of
// toggles: a layer shows or hides one kind of mark, a legend entry shows or
// hides one group of shots. Each says what it hides in its title.

const INK = '#1C211C'
const MUTE = '#8A8B7E'
const FOREST = '#1F3D2C'

export const LAYER_INFO: Record<Layer, { label: string; hides: string }> = {
  rings: { label: 'Rings', hides: 'the two rings (two shots in three, and nearly all)' },
  average: { label: 'Average', hides: 'the average finish and its line from the aim' },
  shots: { label: 'Shots', hides: 'the dot where each shot finished' },
  flights: { label: 'Flights', hides: 'the line of each shot from where it was hit' },
}

function Glyph({ layer, compact }: { layer: Layer; compact?: boolean }) {
  const c = layer === 'rings' || layer === 'average' ? FOREST : INK
  return (
    <svg width={compact ? 16 : 20} height={compact ? 11 : 14} viewBox="0 0 20 14" fill="none" aria-hidden style={{ flex: 'none' }}>
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
      {layer === 'flights' && <path d="M4 13 Q4 3 16 1.5" stroke={c} strokeWidth={1.4} strokeLinecap="round" />}
    </svg>
  )
}

function Toggle({ on, onClick, title, children, onHover, compact }: {
  compact?: boolean
  on: boolean
  onClick: () => void
  title: string
  children: ReactNode
  onHover?: (enter: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      onPointerEnter={onHover && (() => onHover(true))}
      onPointerLeave={onHover && (() => onHover(false))}
      onFocus={onHover && (() => onHover(true))}
      onBlur={onHover && (() => onHover(false))}
      className="hover:bg-caddie-surface-2"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        minHeight: compact ? 36 : 32,
        padding: compact ? '5px 7px 5px 6px' : '5px 9px 5px 7px',
        borderRadius: 2,
        border: on ? '1px solid #D9D2BF' : '1px dashed #D9D2BF',
        background: on ? '#FBF8F1' : 'transparent',
        color: on ? INK : MUTE,
        fontSize: compact ? 12 : 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', opacity: on ? 1 : 0.75 }}>{children}</span>
    </button>
  )
}

export function LayerBar({ layers, available, onToggle, compact }: {
  compact?: boolean
  layers: Record<Layer, boolean>
  available: Layer[]
  onToggle: (l: Layer) => void
}) {
  return (
    <div role="group" aria-label="Show on the chart" className="flex flex-wrap" style={{ gap: compact ? 5 : 6 }}>
      {available.map((l) => {
        const on = layers[l]
        return (
          <Toggle key={l} compact={compact} on={on} onClick={() => onToggle(l)} title={`${on ? 'Hide' : 'Show'} ${LAYER_INFO[l].hides}`}>
            <span className="inline-flex items-center" style={{ gap: compact ? 5 : 7 }}>
              <Glyph layer={l} compact={compact} />
              <span style={{ textDecoration: on ? undefined : 'line-through' }}>{LAYER_INFO[l].label}</span>
            </span>
          </Toggle>
        )
      })}
    </div>
  )
}

export function ColourByControl({ value, onChange }: { value: ColourBy; onChange: (v: ColourBy) => void }) {
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
      <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>Colour by</span>
      <div role="radiogroup" aria-label="Colour by" className="flex" style={{ gap: 14 }}>
        {COLOUR_BY.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: on ? `2px solid ${INK}` : '2px solid transparent',
                padding: '4px 0 3px',
                fontSize: 13,
                fontWeight: on ? 600 : 400,
                color: on ? INK : '#5C6356',
                cursor: 'pointer',
              }}
            >
              {o.label}
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
  count: number
  open?: boolean
}

export function Legend({ entries, hidden, onToggle, onFocus }: {
  entries: LegendEntry[]
  hidden: Set<string>
  onToggle: (k: string) => void
  onFocus: (k: string | null) => void
}) {
  return (
    <div role="group" aria-label="Legend: tap a group to hide it" className="flex flex-wrap" style={{ gap: 6 }}>
      {entries.map((e) => {
        const on = !hidden.has(e.key)
        return (
          <Toggle
            key={e.key}
            on={on}
            onClick={() => onToggle(e.key)}
            onHover={(enter) => onFocus(enter && on ? e.key : null)}
            title={`${on ? 'Hide' : 'Show'} the ${e.count} ${e.label.toLowerCase()} shot${e.count === 1 ? '' : 's'}`}
          >
            <span className="inline-flex items-center" style={{ gap: 7 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <circle cx="5" cy="5" r={e.open ? 3.6 : 4.2} fill={e.open ? '#FBF8F1' : e.color} stroke={e.color} strokeWidth={e.open ? 1.4 : 0} />
              </svg>
              <span style={{ textDecoration: on ? undefined : 'line-through' }}>{e.label}</span>
              <span className="font-serif tabular" style={{ fontSize: 14, color: on ? INK : MUTE }}>{e.count}</span>
            </span>
          </Toggle>
        )
      })}
    </div>
  )
}
