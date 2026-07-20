import { useUnits } from '../../../hooks/useUnits'

interface MapBottomChromeProps {
  hasExistingShots: boolean
  /** True while the user is dragging-to-correct from the review sheet. */
  editing?: boolean
  shotsPlaced: number
  remainingToPin: number | null
  /** Label for the most recent saved-shot drag — when non-null, render
   *  an Undo button on the logged-hole chrome. The parent owns the 5s
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
  /** Currently unused — the tee is derived from the first shot, not placed
   *  manually. Kept for the existing placement plumbing. */
  needsTee?: boolean
  /** Show the "Set pin" placement button. True while logging/editing a past
   *  round on a geo-anchored hole — shown even when a pin coord already
   *  exists so the player can override a wrong crawled pin. */
  showPinButton?: boolean
  /** Active manual-placement mode. When set, the chrome switches to a
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

// Map-only dark chrome — the on-course HUD treatment for surfaces rendered over
// Mapbox satellite imagery. Renders as an absolute, bottom-anchored overlay
// INSIDE the map box (see MapView) —
// not a full-width bar above it. The instruction card is pointer-events:none
// (text only) so taps reach the Mapbox canvas listener underneath; only the
// button row (and only when a button actually matters) is pointer-events:auto.
const MAP_DARK = 'rgba(28,33,28,0.82)'
const MAP_CREAM = '#FBF8F1'
const FOREST = 'var(--caddie-accent)'

const wrapperStyle = {
  position: 'absolute' as const,
  left: 12,
  right: 12,
  bottom: 12,
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: 9,
  alignItems: 'center' as const,
  pointerEvents: 'none' as const,
  zIndex: 5,
}

const cardStyle = {
  pointerEvents: 'none' as const,
  maxWidth: '92%',
  background: MAP_DARK,
  borderRadius: 12,
  padding: '8px 13px',
  textAlign: 'center' as const,
}

const kickerStyle = { color: '#C9C7B8', marginBottom: 2 }
const bodyStyle = { color: MAP_CREAM, fontSize: 13 }
const bodyDimStyle = { color: 'rgba(251,248,241,0.68)', fontSize: 12 }

const buttonRowStyle = {
  pointerEvents: 'auto' as const,
  display: 'flex' as const,
  gap: 9,
  justifyContent: 'center' as const,
  flexWrap: 'wrap' as const,
}

const primaryStyle = {
  pointerEvents: 'auto' as const,
  background: MAP_CREAM,
  color: FOREST,
  border: `1px solid ${FOREST}`,
  borderRadius: 26,
  padding: '11px 20px',
  fontWeight: 700,
  fontSize: 14,
  boxShadow: '0 6px 16px rgba(28,33,28,0.25)',
}

function primaryDisabledStyle(disabled: boolean) {
  return { ...primaryStyle, opacity: disabled ? 0.5 : 1 }
}

const secondaryStyle = {
  pointerEvents: 'auto' as const,
  background: 'rgba(251,248,241,0.92)',
  color: 'var(--caddie-ink)',
  border: '1px solid var(--caddie-line)',
  borderRadius: 22,
  padding: '9px 13px',
  fontSize: 12,
  fontWeight: 600,
}

function secondaryDisabledStyle(disabled: boolean) {
  return { ...secondaryStyle, opacity: disabled ? 0.4 : 1 }
}

function amberStyle(active: boolean) {
  return {
    pointerEvents: 'auto' as const,
    border: '1px solid var(--caddie-warn)',
    borderRadius: 22,
    padding: '9px 13px',
    fontSize: 12,
    background: active ? 'var(--caddie-warn)' : 'transparent',
    color: active ? MAP_CREAM : 'var(--caddie-warn)',
    fontWeight: 600,
    letterSpacing: '0.02em',
  }
}

const brickStyle = {
  pointerEvents: 'auto' as const,
  border: '1px solid var(--caddie-neg)',
  borderRadius: 22,
  padding: '9px 13px',
  fontSize: 12,
  background: 'transparent',
  color: 'var(--caddie-neg)',
  fontWeight: 600,
  letterSpacing: '0.02em',
}

export function MapBottomChrome({
  hasExistingShots,
  editing,
  shotsPlaced,
  remainingToPin,
  pinAvailable = true,
  aimMode = false,
  aimsSet = 0,
  holeNumber,
  needsTee = false,
  showPinButton = false,
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
}: MapBottomChromeProps) {
  const placingNumber = shotsPlaced + 1
  const { toDisplay } = useUnits()
  if (placementMode) {
    const holeLabel = holeNumber != null ? ` for hole ${holeNumber}` : ''
    const targetLabel =
      placementMode === 'tee' ? 'tee box' : 'pin'
    return (
      <div style={wrapperStyle}>
        <div style={cardStyle}>
          <div className="kicker" style={kickerStyle}>
            Place {targetLabel}
          </div>
          <div style={bodyStyle}>
            Tap to place the {targetLabel}{holeLabel}.
          </div>
        </div>
        {onCancelPlacement && (
          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={onCancelPlacement}
              style={secondaryStyle}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    )
  }
  const placeButtons =
    showPinButton && onStartPlacePin ? (
      <>
        {showPinButton && onStartPlacePin && (
          <button type="button" onClick={onStartPlacePin} style={brickStyle}>
            Set pin
          </button>
        )}
      </>
    ) : null
  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>
        {editing ? (
          <>
            <div className="kicker" style={kickerStyle}>
              Edit on map
            </div>
            <div style={bodyStyle}>
              Drag any marker to adjust where the shot was hit from.
            </div>
          </>
        ) : hasExistingShots ? (
          <>
            <div className="kicker" style={kickerStyle}>
              Logged hole
            </div>
            <div style={bodyStyle}>
              {shotDragUndoLabel
                ? `${shotDragUndoLabel} updated.`
                : 'Drag any marker to adjust its position.'}
            </div>
          </>
        ) : aimMode ? (
          <>
            <div className="kicker" style={kickerStyle}>
              Aim line — shot {shotsPlaced}
            </div>
            <div style={bodyStyle}>
              Tap your aim line — where you started shot {shotsPlaced}, not
              where it finished.
            </div>
          </>
        ) : (
          <>
            <div className="kicker" style={kickerStyle}>
              Tap where you hit shot {placingNumber} from
            </div>
            <div style={bodyDimStyle}>
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
      {(shotsPlaced > 0 || editing || placeButtons ||
        (shotDragUndoLabel && onApplyShotDragUndo)) && (
        <div style={buttonRowStyle}>
          {editing ? (
            <>
              {placeButtons}
              <button type="button" onClick={onDoneEditing} style={primaryStyle}>
                Done editing →
              </button>
            </>
          ) : !hasExistingShots ? (
            <>
              {placeButtons}
              {onToggleAimMode && shotsPlaced > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleAimMode(!aimMode)}
                  aria-pressed={aimMode}
                  style={amberStyle(aimMode)}
                >
                  {aimMode ? 'Cancel aim' : 'Set aim'}
                </button>
              )}
              {onClearLastAim && aimsSet > 0 && !aimMode && (
                <button type="button" onClick={onClearLastAim} style={secondaryStyle}>
                  Clear aim
                </button>
              )}
              <button
                type="button"
                disabled={shotsPlaced === 0}
                onClick={onUndo}
                style={secondaryDisabledStyle(shotsPlaced === 0)}
              >
                Undo
              </button>
              <button
                type="button"
                disabled={shotsPlaced === 0}
                onClick={onClear}
                style={secondaryDisabledStyle(shotsPlaced === 0)}
              >
                Clear
              </button>
              <button
                type="button"
                disabled={shotsPlaced === 0}
                onClick={onDone}
                style={primaryDisabledStyle(shotsPlaced === 0)}
              >
                Done with hole →
              </button>
            </>
          ) : (
            <>
              {placeButtons}
              {shotDragUndoLabel && onApplyShotDragUndo && (
                <button
                  type="button"
                  onClick={onApplyShotDragUndo}
                  style={secondaryStyle}
                >
                  Undo
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
