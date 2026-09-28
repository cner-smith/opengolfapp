import { LieSlopeGrid } from '../../forms/LieSlopeGrid'
import type { DistanceUnit } from '@oga/core'
import { Field, NumericInput } from './formInputs'
import { ResultAxes } from './ResultAxes'
import type { DraftShot } from './draft'

interface ShotFormFieldsProps {
  draft: DraftShot
  setDraft: (updater: (d: DraftShot) => DraftShot) => void
  unit: DistanceUnit
}

// Non-putt fields rendered AFTER lie type: lie slope, distance to
// target, shot result. Club is rendered inline by the orchestrator
// before Lie type to preserve the original render order — see the
// JSX in ShotEntryModal. Lie type and Notes stay in the orchestrator
// because they render for putts too.
export function ShotFormFields({
  draft,
  setDraft,
  unit,
}: ShotFormFieldsProps) {
  return (
    <>
      <Field label="Lie slope">
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
      </Field>

      <Field
        label={
          unit === 'meters'
            ? 'Distance to target (metres)'
            : 'Distance to target (yards)'
        }
      >
        <NumericInput
          value={draft.distanceToTarget}
          onChange={(n) =>
            setDraft((d) => ({ ...d, distanceToTarget: n }))
          }
        />
      </Field>

      <Field label="Shot result">
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
      </Field>
    </>
  )
}
