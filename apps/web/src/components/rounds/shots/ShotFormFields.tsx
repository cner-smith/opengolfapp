import { useState } from 'react'
import { LieSlopeGrid } from '../../forms/LieSlopeGrid'
import { formatDistance, type DistanceUnit } from '@oga/core'
import { NumericInput, PickerField } from './formInputs'
import { ResultAxes } from './ResultAxes'
import type { DraftShot } from './draft'

interface ShotFormFieldsProps {
  draft: DraftShot
  setDraft: (updater: (d: DraftShot) => DraftShot) => void
  unit: DistanceUnit
  /** The shot has a start and the hole a pin: the distance to the pin came
   *  from the map, so it reads as text with a Change key. */
  mapped: boolean
}

// Non-putt fields rendered AFTER lie type: lie slope, distance to the
// pin, shot result. Club is rendered inline by the orchestrator
// before Lie type to preserve the original render order — see the
// JSX in ShotEntryModal. Lie type and Notes stay in the orchestrator
// because they render for putts too.
export function ShotFormFields({
  draft,
  setDraft,
  unit,
  mapped,
}: ShotFormFieldsProps) {
  const [typing, setTyping] = useState(false)
  const label = unit === 'meters' ? 'To the pin (m)' : 'To the pin (yd)'
  return (
    <>
      <PickerField title="Slope">
        <LieSlopeGrid
          forward={draft.lieSlopeForward}
          side={draft.lieSlopeSide}
          onChangeForward={(v) =>
            setDraft((d) => ({ ...d, lieSlopeForward: v }))
          }
          onChangeSide={(v) =>
            setDraft((d) => ({ ...d, lieSlopeSide: v }))
          }
          toggleable
        />
      </PickerField>

      <PickerField title="Distance">
        {mapped && !typing && draft.distanceToTarget != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 3 }}>
            <span className="serif-italic tabular text-caddie-ink" style={{ fontSize: 20 }}>
              {formatDistance(draft.distanceToTarget, unit)} to the pin
            </span>
            <button
              type="button"
              onClick={() => setTyping(true)}
              className="key"
              style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}
            >
              Change
            </button>
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }} className="text-caddie-ink">
            <NumericInput
              label={label}
              value={draft.distanceToTarget}
              onChange={(n) =>
                setDraft((d) => ({ ...d, distanceToTarget: n }))
              }
            />
            {unit === 'meters' ? 'm' : 'yd'}
          </label>
        )}
      </PickerField>

      <PickerField title="Result" aside={<span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>all optional</span>}>
        <ResultAxes
          value={{
            contact: draft.contact ?? null,
            shape: draft.shape ?? null,
            startLine: draft.startLine ?? null,
            penalty: !!draft.penalty,
            ob: !!draft.ob,
          }}
          onChange={(v) => setDraft((d) => ({ ...d, ...v }))}
        />
      </PickerField>
    </>
  )
}
