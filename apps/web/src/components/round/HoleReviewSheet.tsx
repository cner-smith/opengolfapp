import { useEffect, useRef, useState } from 'react'
import {
  buildInitialRows,
  combinedBreakDirection,
  haversineYards,
  horizontalBreakFromAim,
  isPuttShot,
  obCount,
  type ReviewedShotRow,
} from '@oga/core'
import { GreenDiagram } from './GreenDiagram'
import type { PlacedPoint } from './RoundMap'
import type { WebPuttData } from './WebPuttingSheet'
import { ShotRow } from './HoleReviewShotRow'
export type { ReviewedShotRow }

interface HoleReviewSheetProps {
  open: boolean
  holeNumber: number
  par: number
  totalPar: number
  pinLat: number | null
  pinLng: number | null
  /** Tap markers — each marker N is the START position of shot N.
   *  End-of-shot for shot N is marker N+1; for the final shot it is
   *  the pin (assumed holed). */
  placedPoints: PlacedPoint[]
  /** Putt metadata pre-collected via the putting sheet at tap time.
   *  Parallel to placedPoints. When the inferred row for that index
   *  is a putt, this data overrides the defaults so the user doesn't
   *  re-enter what they just answered. */
  placedPutts?: (WebPuttData | null)[]
  /** The hole's already-stored shots. Used only to seed `shotResult: 'ob'`
   *  onto the hydrated rows so (a) the score ticker counts the penalty
   *  stroke a mobile live-capture recorded, and (b) `saveReviewedHole` can
   *  derive `ob` from the row alone — matching mobile — instead of OR-ing in
   *  the stored flag, which cannot be cleared from this sheet once set.
   *  Keyed by shot number and gated on an equal count, for the same reason
   *  saveReviewedHole's snapshot is: `placedPoints` is never seeded from
   *  stored shots, so a re-placement with a different shot count has no
   *  correspondence to them and a stale flag would land on the wrong shot. */
  storedShots?: ReadonlyArray<{ shotNumber: number; ob?: boolean | null; penalty?: boolean | null }>
  saving: boolean
  /** "Edit on map" — close the sheet and let the user drag markers. */
  onEditOnMap: () => void
  onSave: (
    rows: ReviewedShotRow[],
    summary: { score: number; putts: number; penalties: number },
  ) => void | Promise<void>
}


export function HoleReviewSheet({
  open,
  holeNumber,
  par,
  pinLat,
  pinLng,
  placedPoints,
  placedPutts,
  storedShots,
  saving,
  onEditOnMap,
  onSave,
}: HoleReviewSheetProps) {
  const [rows, setRows] = useState<ReviewedShotRow[]>([])
  // Score / putts / penalties are editable tickers on the summary. Score and
  // putts pre-fill from the shots you placed (shot count, green-lie shots);
  // penalties is the one number no marker implies. All three become the
  // authoritative hole_scores values on save. #791
  const [score, setScore] = useState(0)
  const [putts, setPutts] = useState(0)
  const [penalties, setPenalties] = useState(0)
  // Which putt row (by shotNumber) has the on-demand aimer open, if any.
  // The read tool is a full-sheet overlay — never auto-opens. #791
  const [aimingShot, setAimingShot] = useState<number | null>(null)

  // Read the latest placedPoints inside the effect via ref so the effect
  // doesn't re-fire (and clobber user edits) just because the parent
  // returned a new array reference. Same trick for placedPutts so a
  // stale inline-collected putt doesn't get re-merged after the user
  // hand-edited the row.
  const placedPointsRef = useRef(placedPoints)
  placedPointsRef.current = placedPoints
  const placedPuttsRef = useRef(placedPutts)
  placedPuttsRef.current = placedPutts
  const storedShotsRef = useRef(storedShots)
  storedShotsRef.current = storedShots

  // Hydrate rows from the placed coordinates once per (hole, open). After
  // hydration the user's typing/dropdown choices are the source of truth —
  // dragging markers updates coords, but does NOT rebuild rows and erase
  // edits. The sheet re-hydrates fresh on next open.
  const hydratedHoleRef = useRef<number | null>(null)
  useEffect(() => {
    if (!open) {
      hydratedHoleRef.current = null
      return
    }
    if (hydratedHoleRef.current === holeNumber) return
    hydratedHoleRef.current = holeNumber
    // When pin coords are unavailable (course has no OSM hole layout and
    // the user hasn't manually placed a pin), build rows directly from
    // placed points: end of shot N is the next placed point, last shot
    // ends at itself, and distance-to-pin reads 0. The user picks club /
    // lie manually since we can't infer them from a missing pin context.
    const points = placedPointsRef.current
    const baseRows: ReviewedShotRow[] =
      pinLat != null && pinLng != null
        ? buildInitialRows(points, par, pinLat, pinLng)
        : points.map((p, idx) => {
            const isLast = idx === points.length - 1
            const next = isLast ? p : points[idx + 1]!
            return {
              shotNumber: idx + 1,
              club: 'driver',
              lieType: idx === 0 ? 'tee' : 'fairway',
              startLat: p.lat,
              startLng: p.lng,
              endLat: next.lat,
              endLng: next.lng,
              distanceYards: haversineYards(p.lat, p.lng, next.lat, next.lng),
              distanceToPin: 0,
              isLastShot: isLast,
            }
          })
    const puttData = placedPuttsRef.current ?? []
    // Merge any inline-collected putt data into the inferred rows so the
    // player doesn't have to re-enter what they just answered in the
    // putting sheet. Distance in feet maps to distanceYards / 3 so the
    // sheet's edit display stays consistent.
    const merged = baseRows.map((row, idx) => {
        const inline = puttData[idx]
        if (!inline) return row
        // A placed putt is on the green by definition — pin lieType so putt
        // classification keys off real intent (lie/club), not raw distance.
        return {
          ...row,
          lieType: 'green' as const,
          puttMade: inline.puttMade,
          puttDistanceResult: inline.puttDistanceResult,
          puttDirectionResult: inline.puttDirectionResult,
          breakDirectionVertical: inline.breakDirectionVertical,
          breakDirectionHorizontal: inline.breakDirectionHorizontal,
          puttSlopePct: inline.puttSlopePct,
          greenSpeed: inline.greenSpeed,
          aimOffsetInches: inline.aimOffsetInches,
          notes: inline.notes,
          distanceYards:
            inline.puttDistanceFt != null
              ? inline.puttDistanceFt / 3
              : row.distanceYards,
        }
      })
    // Seed OB from the hole's already-stored shots BEFORE anything reads the
    // rows. Web has no live capture, so buildInitialRows / the no-pin
    // fallback / the putt merge never set `shotResult`; without this the
    // sheet shows no OB chip for a hole marked OB on mobile and seeds the
    // score one stroke low, then persists that lower value over a correct
    // one. Keyed by shot number (not position) and gated on an equal count,
    // for the same reason saveReviewedHole's snapshot is: `placedPoints` is
    // a fresh placement with no correspondence to the stored shots, so on a
    // count mismatch dropping the flag is correct and moving it to a
    // different shot would be worse (#839).
    const stored = storedShotsRef.current ?? []
    let seeded = merged
    if (stored.length === merged.length) {
      const byNumber = new Map(stored.map((s) => [s.shotNumber, s]))
      // Penalty too: the result picker sends its full value, so an unseeded
      // row would write penalty:false over a stored true once touched.
      seeded = merged.map((row) => {
        const s = byNumber.get(row.shotNumber)
        return {
          ...row,
          ...(s?.ob === true ? { shotResult: 'ob' as const } : {}),
          ...(s?.penalty === true ? { penalty: true } : {}),
        }
      })
    }
    setRows(seeded)
    // Struck rows + penalty strokes. obCount reads the `shotResult: 'ob'`
    // the seed above applied, so this is 0 only when the hole has no stored
    // OB or the count guard rejected the seed. The ±1 bump in the
    // result-picker's onChange below covers edits made after hydration,
    // which this effect deliberately does not re-run for (#839).
    setScore(seeded.length + obCount(seeded))
    // Putt TALLY counts any green-lie shot (isPuttShot), matching the SG
    // putting engine + putt-count readers — a bladed wedge on the green still
    // counts as a putt here even though its row shows normal-shot UI (the
    // per-row isPutt gate below stays isPuttEntry). User-overridable ticker.
    setPutts(merged.filter((r) => isPuttShot(r.lieType)).length)
    // Same OB rows the score just counted (#963).
    setPenalties(obCount(seeded))
  }, [open, holeNumber, par, pinLat, pinLng])

  // Slide-in: mount at translateY(100%), flip to 0 next frame so CSS
  // transition runs. Two rAFs to ensure the initial style commits first.
  const [slidIn, setSlidIn] = useState(false)
  useEffect(() => {
    if (!open) {
      setSlidIn(false)
      return
    }
    const a = requestAnimationFrame(() => {
      const b = requestAnimationFrame(() => setSlidIn(true))
      return () => cancelAnimationFrame(b)
    })
    return () => cancelAnimationFrame(a)
  }, [open])

  if (!open) return null

  const vsPar = score > 0 ? score - par : null

  return (
    <div
      role="dialog"
      aria-label={`Hole ${holeNumber} review`}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        background: '#FBF8F1',
        borderTop: '1px solid #9F9580',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        transform: slidIn ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 220ms ease-out',
        // Fill the whole map area and sit above the map HUD (EXP / rail /
        // PATTERN / aim overlays) so nothing bleeds over the summary. #791
        zIndex: 40,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 8,
          marginBottom: 12,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 32,
            height: 4,
            borderRadius: 2,
            background: '#D9D2BF',
          }}
        />
      </div>
      <div
        style={{
          padding: '0 22px 14px',
          borderBottom: '1px solid #D9D2BF',
        }}
      >
        <div className="kicker" style={{ marginBottom: 4 }}>
          Hole {holeNumber} · Par {par}
        </div>
        <div
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 24,
            fontWeight: 500,
            fontStyle: 'italic',
            marginBottom: 14,
          }}
        >
          Nice — how'd it go?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Ticker label="Score" value={score} onChange={setScore} vsPar={vsPar} />
          <Ticker label="Putts" value={putts} onChange={setPutts} />
          <Ticker label="Penalties" value={penalties} onChange={setPenalties} amber />
        </div>
      </div>

      <div
        style={{
          overflowY: 'auto',
          padding: '4px 22px 14px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {rows.length === 0 ? (
          <div
            className="text-caddie-ink-mute"
            style={{ padding: 22, fontSize: 13 }}
          >
            No placed shots. Drop pins on the map and try again.
          </div>
        ) : (
          <>
          <div
            className="kicker"
            style={{ paddingTop: 10, paddingBottom: 2, color: '#8A8B7E' }}
          >
            Your shots · optional
          </div>
          {rows.map((row, idx) => (
            <ShotRow
              key={row.shotNumber}
              row={row}
              onOpenAimer={() => setAimingShot(row.shotNumber)}
              onChange={(next) => {
                // The score ticker starts at struck-count (obCount is always
                // 0 at seed time — see the hydration effect above) and stays
                // accurate from here on by bumping ±1 every time THIS row's
                // shotResult flips to/from 'ob'. This is the only place
                // shotResult can become 'ob' on web (the result-picker chip
                // in ShotRow), so a flip here is the complete signal — no
                // other write path needs to feed this counter (#839).
                // Compared here against `row` (this render's rows[idx]) in
                // the plain event-handler body, deliberately NOT inside the
                // setRows updater below — a setState call as a side effect
                // of another state's updater function would double-fire
                // under dev Strict Mode's intentional double-invocation of
                // updaters, actually incrementing the score twice.
                if (next.shotResult !== row.shotResult) {
                  if (next.shotResult === 'ob' && row.shotResult !== 'ob') {
                    setScore((s) => s + 1)
                    setPenalties((n) => n + 1)
                  } else if (
                    row.shotResult === 'ob' &&
                    next.shotResult !== 'ob'
                  ) {
                    setScore((s) => Math.max(0, s - 1))
                    setPenalties((n) => Math.max(0, n - 1))
                  }
                }
                // A penalty stroke has no row of its own either, so the
                // Penalty key is worth one stroke on both tickers (#1039).
                const pen = Number(!!next.penalty) - Number(!!row.penalty)
                if (pen !== 0) {
                  setScore((s) => Math.max(0, s + pen))
                  setPenalties((n) => Math.max(0, n + pen))
                }
                // Putts follows the rows: a lie moved onto or off the green
                // is a putt more or fewer.
                const putt =
                  Number(isPuttShot(next.lieType)) - Number(isPuttShot(row.lieType))
                if (putt !== 0) setPutts((p) => Math.max(0, p + putt))
                setRows((prev) => {
                  const copy = prev.slice()
                  copy[idx] = next
                  // When start moves, the prior shot's end no longer
                  // matches — keep them paired so the trajectory line
                  // and SG distances stay consistent on save. Skip when
                  // either coord side is null (synthetic-fallback rows
                  // built without coords); those flows save without
                  // start/end pairing in the first place.
                  const prior = idx > 0 ? prev[idx - 1] : null
                  if (
                    prior &&
                    next.startLat != null &&
                    next.startLng != null &&
                    prior.startLat != null &&
                    prior.startLng != null &&
                    (prior.endLat !== next.startLat ||
                      prior.endLng !== next.startLng)
                  ) {
                    const priorDist = haversineYards(
                      prior.startLat,
                      prior.startLng,
                      next.startLat,
                      next.startLng,
                    )
                    copy[idx - 1] = {
                      ...prior,
                      endLat: next.startLat,
                      endLng: next.startLng,
                      distanceYards: priorDist,
                    }
                  }
                  return copy
                })
              }}
            />
          ))}
          </>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          padding: '14px 22px 18px',
          borderTop: '1px solid #D9D2BF',
          background: '#FBF8F1',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onEditOnMap}
          className="text-caddie-accent"
          style={{
            border: '1px solid #1F3D2C',
            background: 'transparent',
            borderRadius: 2,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          Edit on map
        </button>
        <button
          type="button"
          onClick={() => onSave(rows, { score, putts, penalties })}
          disabled={saving || rows.length === 0}
          className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-40"
          style={{
            borderRadius: 2,
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {saving ? 'Saving…' : 'Save & next hole'}{' '}
          {!saving && (
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          )}
        </button>
      </div>

      {aimingShot != null &&
        (() => {
          const idx = rows.findIndex((r) => r.shotNumber === aimingShot)
          if (idx < 0) return null
          return (
            <AimerOverlay
              row={rows[idx]!}
              onChange={(next) =>
                setRows((prev) => {
                  const copy = prev.slice()
                  copy[idx] = next
                  return copy
                })
              }
              onClose={() => setAimingShot(null)}
            />
          )
        })()}
    </div>
  )
}

function Ticker({
  label,
  value,
  onChange,
  vsPar,
  amber,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  vsPar?: number | null
  amber?: boolean
}) {
  const vsParText =
    vsPar == null ? null : vsPar === 0 ? 'E' : vsPar > 0 ? `+${vsPar}` : `${vsPar}`
  // Muted brick over par, forest under, ink at even — never a bright red.
  const vsParColor =
    vsPar == null || vsPar === 0 ? '#8A8B7E' : vsPar > 0 ? '#A33A2A' : '#1F3D2C'
  const step = (delta: number, disabled: boolean) => (
    <button
      type="button"
      aria-label={`${delta < 0 ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
      onClick={() => onChange(Math.max(0, value + delta))}
      disabled={disabled}
      className="text-caddie-ink-dim disabled:opacity-25"
      style={{
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: '50%',
        border: '1px solid #9F9580',
        background: 'transparent',
        fontSize: 15,
        lineHeight: 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {delta < 0 ? '−' : '+'}
    </button>
  )
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: '#F2EEE5',
        border: '1px solid #D9D2BF',
        borderRadius: 6,
        padding: '9px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {step(-1, value === 0)}
        <span
          className="font-serif tabular"
          style={{
            fontSize: 26,
            fontWeight: 500,
            lineHeight: 1,
            minWidth: 20,
            textAlign: 'center',
            color: amber && value > 0 ? '#A66A1F' : '#1C211C',
          }}
        >
          {value}
        </span>
        {step(1, false)}
      </div>
      <span className="kicker" style={{ color: '#8A8B7E' }}>
        {label}
        {vsParText && (
          <span style={{ color: vsParColor }}> · {vsParText}</span>
        )}
      </span>
    </div>
  )
}


// The on-demand read tool: a full-sheet overlay hosting the draggable green
// aimer. Setting the aim also derives the horizontal break line (aim off the
// pin = the read), mirroring the old putting sheet. #791
function AimerOverlay({
  row,
  onChange,
  onClose,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
  onClose: () => void
}) {
  const distanceFt = row.distanceYards * 3
  const breakDirection =
    combinedBreakDirection({
      vertical: row.breakDirectionVertical ?? null,
      horizontal: row.breakDirectionHorizontal ?? null,
    }) ?? 'straight'
  return (
    <div
      role="dialog"
      aria-label={`Read the green, shot ${row.shotNumber}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#FBF8F1',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '16px 22px 12px',
          borderBottom: '1px solid #D9D2BF',
        }}
      >
        <div className="kicker" style={{ marginBottom: 4, color: '#8A8B7E' }}>
          Shot {row.shotNumber} · read the green
        </div>
        <div
          className="font-serif text-caddie-ink"
          style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic' }}
        >
          Aim &amp; break
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '18px 22px',
        }}
      >
        <GreenDiagram
          distanceFt={distanceFt}
          aimOffsetInches={row.aimOffsetInches ?? 0}
          breakDirection={breakDirection}
          onAimChange={(n) =>
            onChange({
              ...row,
              aimOffsetInches: n,
              breakDirectionHorizontal:
                horizontalBreakFromAim(n) ?? row.breakDirectionHorizontal,
            })
          }
        />
      </div>
      <div
        style={{
          padding: '14px 22px 18px',
          borderTop: '1px solid #D9D2BF',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="bg-caddie-accent text-caddie-accent-ink"
          style={{
            width: '100%',
            borderRadius: 2,
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          Save read
        </button>
      </div>
    </div>
  )
}
