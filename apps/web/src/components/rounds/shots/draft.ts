import type { DraftShot } from '@oga/core'

// Re-export so existing consumers (ShotEntryModal, PuttFormFields,
// ShotFormFields) keep their './draft' imports working. The math lives
// in @oga/core/round.ts.
export { shotRowToDraft, type DraftShot } from '@oga/core'

export function emptyDraft(shotNumber: number, isFirstShot: boolean): DraftShot {
  return {
    shotNumber,
    lieType: isFirstShot ? 'tee' : undefined,
    lieSlopeForward: 'level',
  }
}
