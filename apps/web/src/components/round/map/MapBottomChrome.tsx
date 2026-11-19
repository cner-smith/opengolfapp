import type { ReactNode } from 'react'
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

// Logging chrome over the map, in the #611 paper system: a raised paper tag
// for the instruction (pointer-events:none so taps reach the Mapbox canvas)
// over a row of letterpress keys (.key in index.css).
const wrapperStyle = {
  position: 'absolute' as const,
  left: 12,
  right: 12,
  bottom: 12,
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: 10,
  alignItems: 'center' as const,
  pointerEvents: 'none' as const,
  zIndex: 5,
}

const cardStyle = {
  pointerEvents: 'none' as const,
  maxWidth: '92%',
  background: '#FBF8F1',
  border: '1px solid #1C211C',
  borderRadius: 3,
  boxShadow: '2px 2px 0 rgba(28,33,28,.55)',
  padding: '7px 13px 8px',
  textAlign: 'center' as const,
  color: '#1C211C',
}

const kickerStyle = {
  fontFamily: 'var(--caddie-serif)',
  fontStyle: 'italic' as const,
  fontWeight: 500,
  fontSize: 17,
  lineHeight: '21px',
  marginBottom: 1,
}
const bodyStyle = { fontSize: 13, lineHeight: '17px' }
const bodyDimStyle = { fontSize: 13, lineHeight: '17px', color: '#5C6356' }

const buttonRowStyle = {
  pointerEvents: 'auto' as const,
  display: 'flex' as const,
  gap: 8,
  justifyContent: 'center' as const,
  flexWrap: 'wrap' as const,
  paddingBottom: 3,
}

const keyText = { fontWeight: 400, fontSize: 14, pointerEvents: 'auto' as const }
const primaryStyle = { pointerEvents: 'auto' as const }
const secondaryStyle = keyText
const brickStyle = { ...keyText, color: '#A33A2A' }

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
      <div data-map-chrome style={wrapperStyle}>
        <div style={cardStyle}>
          <div style={kickerStyle}>
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
              className="key" style={secondaryStyle}
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
          <button type="button" onClick={onStartPlacePin} className="key" style={brickStyle}>
            Set pin
          </button>
        )}
      </>
    ) : null
  return (
    <div data-map-chrome style={wrapperStyle}>
      <div style={cardStyle}>
        {editing ? (
          <>
            <div style={kickerStyle}>
              Edit on map
            </div>
            <div style={bodyStyle}>
              Drag any marker to adjust where the shot was hit from.
            </div>
          </>
        ) : hasExistingShots ? (
          <>
            <div style={kickerStyle}>
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
            <div style={kickerStyle}>
              Aim line — shot {shotsPlaced}
            </div>
            <div style={bodyStyle}>
              Tap your aim line — where you started shot {shotsPlaced}, not
              where it finished.
            </div>
          </>
        ) : (
          <>
            <div style={kickerStyle}>
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
              <button type="button" onClick={onDoneEditing} className="key key-primary" style={primaryStyle}>
                Done editing
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
                  className="key" style={keyText}
                >
                  {aimMode ? 'Cancel aim' : 'Set aim'}
                </button>
              )}
              {onClearLastAim && aimsSet > 0 && !aimMode && (
                <button type="button" onClick={onClearLastAim} className="key" style={secondaryStyle}>
                  Clear aim
                </button>
              )}
              <button
                type="button"
                disabled={shotsPlaced === 0}
                onClick={onUndo}
                className="key" style={secondaryStyle}
              >
                Undo
              </button>
              <button
                type="button"
                disabled={shotsPlaced === 0}
                onClick={onClear}
                className="key" style={secondaryStyle}
              >
                Clear
              </button>
              <button
                type="button"
                disabled={shotsPlaced === 0}
                onClick={onDone}
                className="key key-primary" style={primaryStyle}
              >
                Finish hole
              </button>
            </>
          ) : (
            <>
              {placeButtons}
              {shotDragUndoLabel && onApplyShotDragUndo && (
                <button
                  type="button"
                  onClick={onApplyShotDragUndo}
                  className="key" style={secondaryStyle}
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

// Phone width (owner pick A, #1489): the app's footer. One voice line, with
// a trailing key where mobile has one, over a single row of keys, in the
// paper foot under the map. No Clear key: the app has none; Undo repeats.
// Every state is as tall as the review's stepper and keys (61 + 47), so the
// map never resizes under a fitted hole.
const footStyle = { minHeight: 108, display: 'flex' as const, flexDirection: 'column' as const, justifyContent: 'center' as const }
const voiceStyle = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  gap: 10,
  minHeight: 61,
  padding: '6px 2px 4px 4px',
  fontSize: 14,
  lineHeight: '18px',
  color: '#1C211C',
}
const emStyle = { ...kickerStyle, fontSize: 17, marginBottom: 0 }
const rowKey = { fontWeight: 400, fontSize: 14, flex: 1, minWidth: 0, padding: '0 6px', whiteSpace: 'nowrap' as const }
const smallKey = { fontWeight: 400, fontSize: 14, minWidth: 76, padding: '0 12px', flexShrink: 0 }

function Voice({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div style={voiceStyle}>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {trailing}
    </div>
  )
}

type PhoneFootProps = MapBottomChromeProps & { lastHasAim: boolean }

export function PhoneFoot(p: PhoneFootProps) {
  return (
    <div style={footStyle}>
      <FootBody {...p} />
    </div>
  )
}

function FootBody({
  hasExistingShots,
  editing,
  shotsPlaced,
  aimMode = false,
  lastHasAim,
  placementMode = null,
  shotDragUndoLabel = null,
  onApplyShotDragUndo,
  onCancelPlacement,
  onToggleAimMode,
  onClearLastAim,
  onUndo,
  onDone,
  onDoneEditing,
}: PhoneFootProps) {
  if (placementMode) {
    return (
      <Voice
        trailing={
          onCancelPlacement && (
            <button type="button" className="key" onClick={onCancelPlacement} style={smallKey}>
              Cancel
            </button>
          )
        }
      >
        <span style={emStyle}>Where’s the {placementMode === 'tee' ? 'tee' : 'flag'}?</span> Tap it on the map.
      </Voice>
    )
  }
  if (editing) {
    return (
      <>
        <Voice>
          <span style={emStyle}>Edit on map.</span> Drag any marker to move it.
        </Voice>
        <div style={buttonRowStyle}>
          <button type="button" onClick={onDoneEditing} className="key key-primary" style={{ ...rowKey, fontWeight: 600 }}>
            Done editing
          </button>
        </div>
      </>
    )
  }
  if (hasExistingShots) {
    return (
      <Voice
        trailing={
          shotDragUndoLabel &&
          onApplyShotDragUndo && (
            <button type="button" className="key" onClick={onApplyShotDragUndo} style={smallKey}>
              Undo
            </button>
          )
        }
      >
        {shotDragUndoLabel ? (
          `${shotDragUndoLabel} updated.`
        ) : (
          <>
            <span style={emStyle}>Logged hole.</span> Drag any marker to move it.
          </>
        )}
      </Voice>
    )
  }
  return (
    <>
      {aimMode ? (
        <Voice
          trailing={
            lastHasAim &&
            onClearLastAim && (
              <button
                type="button"
                className="key"
                onClick={() => {
                  onClearLastAim()
                  onToggleAimMode?.(false)
                }}
                style={smallKey}
              >
                Clear aim
              </button>
            )
          }
        >
          <span style={emStyle}>Tap your start line</span> for shot {shotsPlaced}.
        </Voice>
      ) : (
        <Voice>
          <span style={emStyle}>Tap where you hit shot {shotsPlaced + 1} from.</span>
          {shotsPlaced === 0 && ' Start at the tee box.'}
        </Voice>
      )}
      {shotsPlaced > 0 && (
        <div style={{ display: 'flex', gap: 8, paddingBottom: 3 }}>
          {onToggleAimMode && (
            <button
              type="button"
              className="key"
              aria-pressed={aimMode}
              onClick={() => onToggleAimMode(!aimMode)}
              style={{ ...rowKey, flex: 1.25 }}
            >
              {aimMode ? 'Cancel' : lastHasAim ? 'Move aim' : 'Set aim'}
            </button>
          )}
          <button type="button" className="key" onClick={onUndo} style={rowKey}>
            Undo
          </button>
          <button type="button" className="key key-primary" onClick={onDone} style={{ ...rowKey, fontWeight: 600, flex: 1.5 }}>
            Finish hole
          </button>
        </div>
      )}
    </>
  )
}
