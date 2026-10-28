import {
  type BreakDirectionVertical,
  type GreenSpeed,
  type PuttDirectionResult,
  type PuttDistanceResult,
} from '@oga/core'
import { Rocker } from '../../ui/Rocker'
import { NumericInput, PickerField, RockerRows } from './formInputs'
import type { DraftShot } from './draft'

// Only the vertical (slope) axis is chosen manually. The horizontal (line)
// axis is derived from the aim handle on the GreenDiagram — see ShotEntryModal.
const BREAK_SLOPE_OPTIONS: { value: BreakDirectionVertical; label: string }[] = [
  { value: 'uphill', label: 'Uphill' },
  { value: 'flat', label: 'Level' },
  { value: 'downhill', label: 'Downhill' },
]

const SLOPE_INTENSITY_OPTIONS = ['Flat', 'Slight', 'Moderate', 'Strong', 'Severe'].map(
  (label, idx) => ({ value: idx, label }),
)

const GREEN_SPEEDS: { value: GreenSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

// Putt vocab mirrors mobile's edit sheet so the two surfaces read alike.
const PUTT_DISTANCE_OPTIONS: { value: PuttDistanceResult; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
]
const PUTT_DIRECTION_OPTIONS: { value: PuttDirectionResult; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]

const hint = (text: string) => (
  <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>
    {text}
  </span>
)

interface PuttFormFieldsProps {
  draft: DraftShot
  setDraft: (updater: (d: DraftShot) => DraftShot) => void
}

// Putt-specific fields rendered AFTER lie type: made/missed, the two miss
// axes, break/slope/speed, putt length. GreenDiagram is rendered inline by
// the orchestrator BEFORE Lie type, matching the original render order.
// Lie type and Notes stay in the orchestrator (rendered for non-putts too).
export function PuttFormFields({ draft, setDraft }: PuttFormFieldsProps) {
  function setPuttMade(made: boolean | undefined) {
    setDraft((d) => ({
      ...d,
      puttMade: made,
      puttDistanceResult: made ? undefined : d.puttDistanceResult,
      puttDirectionResult: made ? undefined : d.puttDirectionResult,
    }))
  }

  return (
    <>
      <PickerField title="Putt">
        <Rocker
          label="Putt"
          options={[
            { value: 'made', label: 'Holed it' },
            { value: 'missed', label: 'Missed' },
          ]}
          value={draft.puttMade === true ? 'made' : draft.puttMade === false ? 'missed' : null}
          onChange={(v) => setPuttMade(v === 'made')}
          onClear={() => setPuttMade(undefined)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }} className="text-caddie-ink">
          <span style={{ width: 52, fontSize: 12 }}>Length</span>
          <NumericInput
            label="Putt length in feet"
            value={draft.puttDistanceFt}
            step="0.5"
            onChange={(n) =>
              setDraft((d) => ({ ...d, puttDistanceFt: n }))
            }
          />
          ft
        </label>
      </PickerField>
      {/* Putt miss = two independent axes (CLAUDE.md) — never one picker. */}
      {draft.puttMade !== true && (
        <PickerField title="Miss" aside={hint('leave blank if it was good')}>
          <RockerRows
            name="Miss distance"
            label="Distance"
            options={PUTT_DISTANCE_OPTIONS}
            value={draft.puttDistanceResult}
            onChange={(v) =>
              setDraft((d) => ({ ...d, puttMade: false, puttDistanceResult: v ?? undefined }))
            }
          />
          <RockerRows
            name="Miss direction"
            label="Missed"
            options={PUTT_DIRECTION_OPTIONS}
            value={draft.puttDirectionResult}
            onChange={(v) =>
              setDraft((d) => ({ ...d, puttMade: false, puttDirectionResult: v ?? undefined }))
            }
          />
        </PickerField>
      )}
      <PickerField title="Break" aside={hint('the line comes from your aim')}>
        <RockerRows
          name="Break slope"
          label="Slope"
          options={BREAK_SLOPE_OPTIONS}
          value={draft.breakDirectionVertical}
          onChange={(v) => setDraft((d) => ({ ...d, breakDirectionVertical: v ?? undefined }))}
        />
      </PickerField>
      <PickerField title="How much it breaks">
        <RockerRows
          name="How much it breaks"
          options={SLOPE_INTENSITY_OPTIONS}
          value={draft.puttSlopePct}
          onChange={(v) => setDraft((d) => ({ ...d, puttSlopePct: v ?? undefined }))}
        />
      </PickerField>
      <PickerField title="Green speed">
        <RockerRows
          name="Green speed"
          options={GREEN_SPEEDS}
          value={draft.greenSpeed}
          onChange={(v) => setDraft((d) => ({ ...d, greenSpeed: v ?? undefined }))}
        />
      </PickerField>
    </>
  )
}
