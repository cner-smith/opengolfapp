import { type BreakDirection, type GreenSpeed } from '@oga/core'
import { GreenDiagram } from '../../round/GreenDiagram'
import {
  Field,
  NumericInput,
  PuttResultButton,
  chipStyle,
} from './formInputs'
import type { DraftShot } from './draft'

const BREAK_OPTIONS: {
  value: Exclude<BreakDirection, 'left' | 'right'>
  label: string
}[] = [
  { value: 'left_to_right', label: 'L → R' },
  { value: 'straight', label: 'Straight' },
  { value: 'right_to_left', label: 'R → L' },
  { value: 'uphill', label: 'Uphill' },
  { value: 'downhill', label: 'Downhill' },
]

const SLOPE_INTENSITY_LABELS = ['Flat', 'Slight', 'Moderate', 'Strong', 'Severe']

const GREEN_SPEEDS: { value: GreenSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

interface PuttFormFieldsProps {
  draft: DraftShot
  setDraft: (updater: (d: DraftShot) => DraftShot) => void
}

// Putt-specific fields: green diagram, made/missed toggle, distance &
// direction selectors, break/slope/speed, distance override. Lie type
// and Notes stay in the orchestrator (rendered for non-putts too).
export function PuttFormFields({ draft, setDraft }: PuttFormFieldsProps) {
  function setPuttMade(made: boolean) {
    setDraft((d) => ({
      ...d,
      puttMade: made,
      puttDistanceResult: made ? undefined : d.puttDistanceResult,
      puttDirectionResult: made ? undefined : d.puttDirectionResult,
    }))
  }

  function setPuttDistanceResult(v: 'short' | 'long') {
    setDraft((d) => ({
      ...d,
      puttMade: false,
      puttDistanceResult: d.puttDistanceResult === v ? undefined : v,
    }))
  }

  function setPuttDirectionResult(v: 'left' | 'right') {
    setDraft((d) => ({
      ...d,
      puttMade: false,
      puttDirectionResult: d.puttDirectionResult === v ? undefined : v,
    }))
  }

  return (
    <>
      <GreenDiagram
        distanceFt={draft.puttDistanceFt ?? 0}
        aimOffsetInches={draft.aimOffsetInches ?? 0}
        breakDirection={draft.breakDirection ?? 'straight'}
        onAimChange={(n) =>
          setDraft((d) => ({ ...d, aimOffsetInches: n }))
        }
      />

      <Field label="Made?">
        <div className="flex" style={{ gap: 8 }}>
          <PuttResultButton
            label="Holed it"
            active={draft.puttMade === true}
            onClick={() => setPuttMade(draft.puttMade !== true)}
          />
          <div style={{ flex: 2 }} />
        </div>
      </Field>
      <Field label="Distance">
        <div className="flex" style={{ gap: 8 }}>
          <PuttResultButton
            label="Short"
            active={
              !draft.puttMade && draft.puttDistanceResult === 'short'
            }
            disabled={draft.puttMade === true}
            onClick={() => setPuttDistanceResult('short')}
          />
          <PuttResultButton
            label="Long"
            active={
              !draft.puttMade && draft.puttDistanceResult === 'long'
            }
            disabled={draft.puttMade === true}
            onClick={() => setPuttDistanceResult('long')}
          />
          <div style={{ flex: 1 }} />
        </div>
        <div
          className="font-mono uppercase text-caddie-ink-mute"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            marginTop: 8,
          }}
        >
          Tap again to clear · leave blank if pace was right
        </div>
      </Field>
      <Field label="Direction">
        <div className="flex" style={{ gap: 8 }}>
          <PuttResultButton
            label="Missed left"
            active={
              !draft.puttMade && draft.puttDirectionResult === 'left'
            }
            disabled={draft.puttMade === true}
            onClick={() => setPuttDirectionResult('left')}
          />
          <PuttResultButton
            label="Missed right"
            active={
              !draft.puttMade && draft.puttDirectionResult === 'right'
            }
            disabled={draft.puttMade === true}
            onClick={() => setPuttDirectionResult('right')}
          />
        </div>
        <div
          className="font-mono uppercase text-caddie-ink-mute"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            marginTop: 8,
          }}
        >
          Tap again to clear · leave blank if line was good
        </div>
      </Field>
      <Field label="Break">
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {BREAK_OPTIONS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, breakDirection: b.value }))
              }
              style={chipStyle(draft.breakDirection === b.value)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="How much">
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {SLOPE_INTENSITY_LABELS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, puttSlopePct: idx }))
              }
              style={chipStyle(draft.puttSlopePct === idx)}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Speed">
        <div className="flex" style={{ gap: 6 }}>
          {GREEN_SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, greenSpeed: s.value }))
              }
              style={chipStyle(draft.greenSpeed === s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Distance override (ft)">
        <NumericInput
          value={draft.puttDistanceFt}
          step="0.5"
          onChange={(n) =>
            setDraft((d) => ({ ...d, puttDistanceFt: n }))
          }
        />
      </Field>
    </>
  )
}
