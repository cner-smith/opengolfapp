import { useUnits } from '../../../hooks/useUnits'

interface RoundMapInstructionStripProps {
  hasExistingShots: boolean
  /** True while the user is dragging-to-correct from the review sheet. */
  editing?: boolean
  shotsPlaced: number
  remainingToPin: number | null
  /** Label for the most recent saved-shot drag — when non-null, render
   *  an Undo button on the logged-hole strip. The parent owns the 5s
   *  fade timer and clears the label by passing null. */
  shotDragUndoLabel?: string | null
  onApplyShotDragUndo?: () => void
  /** False when this hole has no pin coordinates — drives the "— to
   *  pin" placeholder instead of just hiding the distance silently. */
  pinAvailable?: boolean
  /** Aim mode: next tap sets aim for the latest placed shot. */
  aimMode?: boolean
  /** Number of placed shots that already have an aim point. */
  aimsSet?: number
  /** Active hole number — surfaced in the manual-placement instruction
   *  copy so the user knows which hole they're marking up. */
  holeNumber?: number
  /** True when no tee coordinate exists for this hole (DB null and no
   *  session override). Drives the "Place tee box" entry button. */
  needsTee?: boolean
  /** True when no pin coordinate exists for this hole. */
  needsPin?: boolean
  /** Active manual-placement mode. When set, the strip switches to a
   *  "tap to place …" prompt with a Cancel button. */
  placementMode?: 'tee' | 'pin' | null
  onStartPlaceTee?: () => void
  onStartPlacePin?: () => void
  onCancelPlacement?: () => void
  onToggleAimMode?: (on: boolean) => void
  onClearLastAim?: () => void
  onUndo: () => void
  onClear: () => void
  onDone: () => void
  onDoneEditing?: () => void
}

// Strip used to live inside the map as an absolute overlay, but the
// "Done" button kept colliding with Mapbox's zoom controls. It now
// renders as a separate full-width bar above the map. See MapView in
// RoundDetailPage for the layout.
export function RoundMapInstructionStrip({
  hasExistingShots,
  editing,
  shotsPlaced,
  remainingToPin,
  pinAvailable = true,
  aimMode = false,
  aimsSet = 0,
  holeNumber,
  needsTee = false,
  needsPin = false,
  placementMode = null,
  shotDragUndoLabel = null,
  onApplyShotDragUndo,
  onStartPlaceTee,
  onStartPlacePin,
  onCancelPlacement,
  onToggleAimMode,
  onClearLastAim,
  onUndo,
  onClear,
  onDone,
  onDoneEditing,
}: RoundMapInstructionStripProps) {
  const placingNumber = shotsPlaced + 1
  const { toDisplay } = useUnits()
  if (placementMode) {
    const holeLabel = holeNumber != null ? ` for hole ${holeNumber}` : ''
    const targetLabel =
      placementMode === 'tee' ? 'tee box' : 'pin'
    return (
      <div
        style={{
          background: '#FBF8F1',
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '10px 14px',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 200 }}>
          <div className="kicker" style={{ marginBottom: 2 }}>
            Place {targetLabel}
          </div>
          <div className="text-caddie-ink" style={{ fontSize: 13 }}>
            Tap to place the {targetLabel}{holeLabel}.
          </div>
        </div>
        {onCancelPlacement && (
          <button
            type="button"
            onClick={onCancelPlacement}
            className="text-caddie-ink-dim"
            style={{
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '6px 10px',
              fontSize: 12,
              background: 'transparent',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    )
  }
  const placeButtons =
    needsPin && onStartPlacePin ? (
      <>
        {needsPin && onStartPlacePin && (
          <button
            type="button"
            onClick={onStartPlacePin}
            style={{
              border: '1px solid #A33A2A',
              borderRadius: 2,
              padding: '6px 10px',
              fontSize: 12,
              background: 'transparent',
              color: '#A33A2A',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            Place pin
          </button>
        )}
      </>
    ) : null
  return (
    <div
      style={{
        background: '#FBF8F1',
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: '10px 14px',
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 200 }}>
        {editing ? (
          <>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Edit on map
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 13 }}>
              Drag any marker to adjust where the shot was hit from.
            </div>
          </>
        ) : hasExistingShots ? (
          <>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Logged hole
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 13 }}>
              {shotDragUndoLabel
                ? `${shotDragUndoLabel} updated.`
                : 'Drag any marker to adjust its position.'}
            </div>
          </>
        ) : aimMode ? (
          <>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Aim line — shot {shotsPlaced}
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 13 }}>
              Tap your aim line — where you started shot {shotsPlaced}, not
              where it finished.
            </div>
          </>
        ) : (
          <>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Tap where you hit shot {placingNumber} from
            </div>
            <div
              className="text-caddie-ink-dim"
              style={{ fontSize: 12 }}
            >
              {shotsPlaced === 0
                ? 'Start at the tee box.'
                : `${shotsPlaced} shot${shotsPlaced === 1 ? '' : 's'} placed${
                    aimsSet > 0 ? ` · ${aimsSet} aim${aimsSet === 1 ? '' : 's'} set` : ''
                  }${
                    remainingToPin != null
                      ? ` · ${toDisplay(remainingToPin)} to pin`
                      : pinAvailable
                        ? ''
                        : ' · — to pin'
                  }.`}
            </div>
          </>
        )}
      </div>
      {editing ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {placeButtons}
          <button
            type="button"
            onClick={onDoneEditing}
            className="bg-caddie-accent text-caddie-accent-ink"
            style={{
              borderRadius: 2,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            Done editing →
          </button>
        </div>
      ) : !hasExistingShots ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {placeButtons}
          {onToggleAimMode && shotsPlaced > 0 && (
            <button
              type="button"
              onClick={() => onToggleAimMode(!aimMode)}
              aria-pressed={aimMode}
              style={{
                border: '1px solid #A66A1F',
                borderRadius: 2,
                padding: '6px 10px',
                fontSize: 12,
                background: aimMode ? '#A66A1F' : 'transparent',
                color: aimMode ? '#F2EEE5' : '#A66A1F',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              {aimMode ? 'Cancel aim' : 'Set aim'}
            </button>
          )}
          {onClearLastAim && aimsSet > 0 && !aimMode && (
            <button
              type="button"
              onClick={onClearLastAim}
              className="text-caddie-ink-dim"
              style={{
                border: '1px solid #D9D2BF',
                borderRadius: 2,
                padding: '6px 10px',
                fontSize: 12,
                background: 'transparent',
              }}
            >
              Clear aim
            </button>
          )}
          <button
            type="button"
            disabled={shotsPlaced === 0}
            onClick={onUndo}
            className="text-caddie-ink-dim disabled:opacity-40"
            style={{
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '6px 10px',
              fontSize: 12,
              background: 'transparent',
            }}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={shotsPlaced === 0}
            onClick={onClear}
            className="text-caddie-ink-dim disabled:opacity-40"
            style={{
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '6px 10px',
              fontSize: 12,
              background: 'transparent',
            }}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={shotsPlaced === 0}
            onClick={onDone}
            className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-40"
            style={{
              borderRadius: 2,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            Done with hole →
          </button>
        </div>
      ) : (placeButtons || (shotDragUndoLabel && onApplyShotDragUndo)) ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {placeButtons}
          {shotDragUndoLabel && onApplyShotDragUndo && (
            <button
              type="button"
              onClick={onApplyShotDragUndo}
              className="text-caddie-ink-dim"
              style={{
                border: '1px solid #D9D2BF',
                borderRadius: 2,
                padding: '6px 10px',
                fontSize: 12,
                background: 'transparent',
              }}
            >
              Undo
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
