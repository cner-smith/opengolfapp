import {
  SHOT_RESULTS,
  SHOT_RESULT_LABELS,
  type Club,
  type ShotResult,
} from '@oga/core'
import { LieSlopeGrid } from '../../forms/LieSlopeGrid'
import type { DistanceUnit } from '@oga/core'
import { ChipGroup, Field, NumericInput } from './formInputs'
import type { DraftShot } from './draft'

const SHOT_RESULT_OPTIONS: { value: ShotResult; label: string }[] =
  SHOT_RESULTS.map((r) => ({ value: r, label: SHOT_RESULT_LABELS[r] }))

interface ShotFormFieldsProps {
  draft: DraftShot
  setDraft: (updater: (d: DraftShot) => DraftShot) => void
  clubOptions: { value: string; label: string }[]
  unit: DistanceUnit
}

// Non-putt fields: club, lie slope, distance to target, shot result.
// Lie type and Notes stay in the orchestrator because they render for
// putts too.
export function ShotFormFields({
  draft,
  setDraft,
  clubOptions,
  unit,
}: ShotFormFieldsProps) {
  return (
    <>
      <Field label="Club">
        <ChipGroup
          value={draft.club}
          options={clubOptions}
          onChange={(v) =>
            setDraft((d) => ({ ...d, club: v as Club | undefined }))
          }
        />
      </Field>

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
        <ChipGroup
          value={draft.shotResult}
          options={SHOT_RESULT_OPTIONS}
          onChange={(v) => setDraft((d) => ({ ...d, shotResult: v }))}
        />
      </Field>
    </>
  )
}
