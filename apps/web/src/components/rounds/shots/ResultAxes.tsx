import {
  SHOT_CONTACT_LABELS,
  SHOT_CONTACTS,
  SHOT_SHAPE_LABELS,
  SHOT_SHAPES,
  SHOT_START_LINE_LABELS,
  SHOT_START_LINES,
  type ShotContact,
  type ShotResultAxes,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import type { ReactNode } from 'react'
import { chipStyle } from './formInputs'

export type ResultValue = ShotResultAxes & { penalty: boolean; ob: boolean }

// Glyphs mirror mobile's result picker (#611 §19.10), in currentColor so
// they follow the chip's active colour.
const STRIKE_MARK: Record<ShotContact, string> = {
  solid: 'M9 13.5 L12 11',
  fat: 'M3 16 Q6 13 10 15',
  thin: 'M8 9.5 H12',
  topped: 'M9 5 L13 6.5',
  shank: 'M20 12 L24 6',
}
const SHAPE_BEND: Record<ShotShape, number> = { hook: -9, draw: -4.5, straight: 0, fade: 4.5, slice: 9 }
const START_OFF: Record<ShotStartLine, number> = { pull: -7, on_line: 0, push: 7 }

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width="28" height="18" viewBox="0 0 28 18" fill="none" stroke="currentColor" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 2px' }}>
      {children}
    </svg>
  )
}

function AxisRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; glyph: ReactNode }[]
  value: T | null
  onChange: (v: T | null) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 52, fontSize: 12, color: '#1C211C' }}>{label}</span>
      <div style={{ display: 'flex', flex: 1, gap: 4 }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}
            style={{ ...chipStyle(value === o.value), flex: 1, padding: '5px 2px' }}
          >
            {o.glyph}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Shot result as three optional axes + penalty / OB toggles (#951). Tap to
// set, tap again to clear; nothing is pre-selected.
export function ResultAxes({ value, onChange }: { value: ResultValue; onChange: (v: ResultValue) => void }) {
  const any = value.contact || value.shape || value.startLine || value.penalty || value.ob
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <AxisRow
        label="Contact"
        value={value.contact}
        onChange={(contact) => onChange({ ...value, contact })}
        options={SHOT_CONTACTS.map((c) => ({
          value: c,
          label: SHOT_CONTACT_LABELS[c],
          glyph: (
            <Glyph>
              <path d="M1 14 H27" strokeWidth={1.4} />
              <circle cx={16} cy={9.5} r={4.2} strokeWidth={1.4} />
              <path d={STRIKE_MARK[c]} strokeWidth={2.2} />
            </Glyph>
          ),
        }))}
      />
      <AxisRow
        label="Shape"
        value={value.shape}
        onChange={(shape) => onChange({ ...value, shape })}
        options={SHOT_SHAPES.map((sh) => {
          const b = SHAPE_BEND[sh]
          return {
            value: sh,
            label: SHOT_SHAPE_LABELS[sh],
            glyph: (
              <Glyph>
                <circle cx={14} cy={16} r={1.8} fill="currentColor" stroke="none" />
                <path d={`M14 15 Q${14 - b * 0.2} 8 ${14 + b} 2`} strokeWidth={1.5} />
                <path d="M14 1v3" strokeWidth={1} opacity={0.35} />
              </Glyph>
            ),
          }
        })}
      />
      <AxisRow
        label="Start"
        value={value.startLine}
        onChange={(startLine) => onChange({ ...value, startLine })}
        options={SHOT_START_LINES.map((st) => ({
          value: st,
          label: SHOT_START_LINE_LABELS[st],
          glyph: (
            <Glyph>
              <path d="M14 1 V17" strokeWidth={1} strokeDasharray="1.5 2" opacity={0.35} />
              <circle cx={14} cy={16} r={1.8} fill="currentColor" stroke="none" />
              <path d={`M14 15 L${14 + START_OFF[st]} 3`} strokeWidth={1.5} />
            </Glyph>
          ),
        }))}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 52 }} />
        <button
          type="button"
          aria-pressed={value.penalty}
          onClick={() => onChange({ ...value, penalty: !value.penalty })}
          style={{ ...chipStyle(value.penalty), flex: 1 }}
        >
          Penalty stroke
        </button>
        <button
          type="button"
          aria-pressed={value.ob}
          onClick={() => onChange({ ...value, ob: !value.ob })}
          style={{ ...chipStyle(value.ob), flex: 1 }}
        >
          Out of bounds
        </button>
        {any && (
          <button
            type="button"
            onClick={() => onChange({ contact: null, shape: null, startLine: null, penalty: false, ob: false })}
            style={{ background: 'none', border: 'none', fontSize: 13, textDecoration: 'underline', color: '#1C211C' }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
