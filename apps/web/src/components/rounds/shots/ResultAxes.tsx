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
import { useProfile } from '../../../hooks/useProfile'
import { Rocker } from '../../ui/Rocker'
import { PickerRow } from './formInputs'

export type ResultValue = ShotResultAxes & { penalty: boolean; ob: boolean }

// Glyphs mirror mobile's result picker (#611 §19.10), in currentColor.
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
    <PickerRow label={label}>
      <Rocker
        label={label}
        options={options}
        value={value}
        onChange={onChange}
        onClear={() => onChange(null)}
        className="rocker-tight rocker-glyph"
      />
    </PickerRow>
  )
}

// Shot result as three optional axes + penalty / OB toggles (#951). Tap to
// set, tap again to clear; nothing is pre-selected.
export function ResultAxes({
  value,
  onChange,
  penaltyCountsStroke = false,
}: {
  value: ResultValue
  onChange: (v: ResultValue) => void
  /** The end-of-hole review adds the stroke to the hole score; say so. */
  penaltyCountsStroke?: boolean
}) {
  const any = value.contact || value.shape || value.startLine || value.penalty || value.ob
  // A left-hander's hook curves right: mirror the shape + start keys (same
  // as mobile's ResultPicker), from Settings → Plays.
  const { data: profile } = useProfile()
  const flip = profile?.plays_left_handed ? -1 : 1
  const shapes = flip < 0 ? [...SHOT_SHAPES].reverse() : SHOT_SHAPES
  const starts = flip < 0 ? [...SHOT_START_LINES].reverse() : SHOT_START_LINES
  return (
    <div style={{ display: 'grid', gap: 8 }}>
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
        options={shapes.map((sh) => {
          const b = SHAPE_BEND[sh] * flip
          return {
            value: sh,
            label: SHOT_SHAPE_LABELS[sh],
            glyph: (
              <Glyph>
                {/* Shifted by half the lean so it sits centred (as mobile). */}
                <g transform={`translate(${-b / 2} 0)`}>
                  <circle cx={14} cy={16} r={1.8} fill="currentColor" stroke="none" />
                  <path d={`M14 15 Q${14 - b * 0.2} 8 ${14 + b} 2`} strokeWidth={1.5} />
                  <path d="M14 1v3" strokeWidth={1} opacity={0.35} />
                </g>
              </Glyph>
            ),
          }
        })}
      />
      <AxisRow
        label="Start"
        value={value.startLine}
        onChange={(startLine) => onChange({ ...value, startLine })}
        options={starts.map((st) => ({
          value: st,
          label: SHOT_START_LINE_LABELS[st],
          glyph: (
            <Glyph>
              <g transform={`translate(${(-START_OFF[st] * flip) / 2} 0)`}>
                <path d="M14 1 V17" strokeWidth={1} strokeDasharray="1.5 2" opacity={0.35} />
                <circle cx={14} cy={16} r={1.8} fill="currentColor" stroke="none" />
                <path d={`M14 15 L${14 + START_OFF[st] * flip} 3`} strokeWidth={1.5} />
              </g>
            </Glyph>
          ),
        }))}
      />
      <PickerRow label="">
        <div style={{ display: 'flex', gap: 6, paddingBottom: 3 }}>
          <button
            type="button"
            aria-pressed={value.penalty}
            onClick={() => onChange({ ...value, penalty: !value.penalty })}
            className="key"
            style={{ flex: 1, padding: '0 8px', fontSize: 13, fontWeight: value.penalty ? 600 : 500 }}
          >
            Penalty stroke
          </button>
          <button
            type="button"
            aria-pressed={value.ob}
            onClick={() => onChange({ ...value, ob: !value.ob })}
            className="key"
            style={{ flex: 1, padding: '0 8px', fontSize: 13, fontWeight: value.ob ? 600 : 500 }}
          >
            Out of bounds
          </button>
        </div>
      </PickerRow>
      {any && (
        <button
          type="button"
          onClick={() => onChange({ contact: null, shape: null, startLine: null, penalty: false, ob: false })}
          className="text-caddie-ink"
          style={{ justifySelf: 'end', minHeight: 32, background: 'none', border: 'none', fontSize: 13, textDecoration: 'underline' }}
        >
          Clear result
        </button>
      )}
      {penaltyCountsStroke && (
        <p className="text-caddie-ink-dim" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>
          {value.penalty ? 'One stroke added to the hole score.' : 'Adds one stroke to the hole score.'}
        </p>
      )}
    </div>
  )
}
