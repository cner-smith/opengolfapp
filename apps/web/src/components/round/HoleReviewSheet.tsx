import { useEffect, useState } from 'react'
import {
  CLUBS,
  LIE_TYPES,
  inferShot,
  type Club,
  type InferredShot,
  type LieType,
  type PlacedShot,
} from '@oga/core'
import type { PlacedPoint } from './RoundMap'
import { useUnits } from '../../hooks/useUnits'

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
  saving: boolean
  /** "Edit on map" — close the sheet and let the user drag markers. */
  onEditOnMap: () => void
  onSave: (rows: ReviewedShotRow[]) => void | Promise<void>
}

export interface ReviewedShotRow {
  shotNumber: number
  club: Club
  lieType: LieType
  startLat: number | null
  startLng: number | null
  endLat: number
  endLng: number
  distanceYards: number
  distanceToPin: number
  isLastShot: boolean
  /** Set when the user toggles "Made it ✓" on a putt row.
   *  Stored as putt_result='made' on save. */
  puttMade?: boolean
  /** When puttMade is false, the user can pick a miss flavour.
   *  Stored as putt_result on save. */
  puttResult?: 'short' | 'long' | 'missed_left' | 'missed_right'
}

const PUTT_MISS_OPTIONS: {
  value: 'short' | 'long' | 'missed_left' | 'missed_right'
  label: string
}[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
  { value: 'missed_left', label: 'Missed left' },
  { value: 'missed_right', label: 'Missed right' },
]

export function HoleReviewSheet({
  open,
  holeNumber,
  par,
  pinLat,
  pinLng,
  placedPoints,
  saving,
  onEditOnMap,
  onSave,
}: HoleReviewSheetProps) {
  const [rows, setRows] = useState<ReviewedShotRow[]>([])

  useEffect(() => {
    if (!open) return
    if (pinLat == null || pinLng == null) {
      // No pin coords on this hole — distances meaningless. Bail with empty.
      setRows([])
      return
    }
    setRows(buildInitialRows(placedPoints, par, pinLat, pinLng))
    // Rebuild whenever the marker count or any marker's coordinates
    // change so dragging in edit mode flows back into the displayed
    // distances when the sheet reopens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    holeNumber,
    placedPoints.length,
    pinLat,
    pinLng,
    placedPoints.map((p) => `${p.lat},${p.lng}`).join('|'),
  ])

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

  return (
    <div
      role="dialog"
      aria-label={`Hole ${holeNumber} review`}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: 'min(60vh, 60%)',
        background: '#FBF8F1',
        borderTop: '1px solid #9F9580',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        transform: slidIn ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 220ms ease-out',
        zIndex: 5,
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
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '0 22px 14px',
          borderBottom: '1px solid #D9D2BF',
        }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>
            Hole {holeNumber} review
          </div>
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic' }}
          >
            {rows.length} shot{rows.length === 1 ? '' : 's'} · par {par}
          </div>
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
          rows.map((row, idx) => (
            <ShotRow
              key={row.shotNumber}
              row={row}
              onChange={(next) =>
                setRows((prev) => {
                  const copy = prev.slice()
                  copy[idx] = next
                  return copy
                })
              }
            />
          ))
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
          onClick={() => onSave(rows)}
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
          {saving ? 'Saving…' : 'Save hole'}{' '}
          {!saving && (
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

function ShotRow({
  row,
  onChange,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
}) {
  const isPutt = row.lieType === 'green' || row.club === 'putter'
  const { toDisplay, toDisplayFt } = useUnits()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid #D9D2BF',
        flexWrap: 'wrap',
      }}
    >
      <div
        className="kicker"
        style={{ minWidth: 56 }}
      >
        Shot {row.shotNumber}
      </div>
      <div
        className="font-serif tabular text-caddie-ink"
        style={{
          fontSize: 22,
          fontWeight: 500,
          fontStyle: 'italic',
          minWidth: 100,
        }}
      >
        {isPutt
          ? `${toDisplayFt(row.distanceYards * 3)} putt`
          : toDisplay(row.distanceYards)}
      </div>
      <select
        value={row.club}
        onChange={(e) => onChange({ ...row, club: e.target.value as Club })}
        className="bg-caddie-bg text-caddie-ink"
        style={{
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '8px 10px',
          fontSize: 13,
          minWidth: 110,
        }}
      >
        {CLUBS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        value={row.lieType}
        onChange={(e) =>
          onChange({ ...row, lieType: e.target.value as LieType })
        }
        className="bg-caddie-bg text-caddie-ink"
        style={{
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '8px 10px',
          fontSize: 13,
          minWidth: 110,
        }}
      >
        {LIE_TYPES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {isPutt && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...row,
              puttMade: !row.puttMade,
              // Toggling made → on clears any miss result.
              puttResult: !row.puttMade ? undefined : row.puttResult,
            })
          }
          aria-pressed={!!row.puttMade}
          style={{
            background: row.puttMade ? '#1F3D2C' : '#FBF8F1',
            color: row.puttMade ? '#F2EEE5' : '#1F3D2C',
            border: '1px solid #1F3D2C',
            borderRadius: 2,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.02em',
            cursor: 'pointer',
          }}
        >
          {row.puttMade ? 'Made it ✓' : 'Made it'}
        </button>
      )}
      <span
        className="text-caddie-ink-mute"
        style={{ fontSize: 12, marginLeft: 'auto' }}
      >
        {toDisplay(row.distanceToPin)} to pin
      </span>
      {isPutt && !row.puttMade && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            width: '100%',
            marginLeft: 0,
          }}
        >
          <span
            className="kicker"
            style={{
              alignSelf: 'center',
              color: '#5C6356',
              marginRight: 4,
            }}
          >
            Miss
          </span>
          {PUTT_MISS_OPTIONS.map((opt) => {
            const active = row.puttResult === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...row,
                    // Tap-to-clear so the user can drop the miss tag entirely.
                    puttResult: active ? undefined : opt.value,
                  })
                }
                style={{
                  background: active ? '#1F3D2C' : '#EBE5D6',
                  color: active ? '#F2EEE5' : '#1C211C',
                  border: 'none',
                  borderRadius: 2,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: active ? 500 : 400,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function buildInitialRows(
  points: PlacedPoint[],
  par: number,
  pinLat: number,
  pinLng: number,
): ReviewedShotRow[] {
  const total = points.length
  const rows: ReviewedShotRow[] = []
  points.forEach((p, idx) => {
    const isLast = idx === total - 1
    // End of shot N is the next marker. The final shot ends at the pin
    // (the player holed it; the "Made it" toggle below lets them say
    // otherwise but the on-map ending stays at the cup either way).
    const next = isLast
      ? { lat: pinLat, lng: pinLng }
      : points[idx + 1]!
    const placed: PlacedShot = {
      shotNumber: idx + 1,
      startLat: p.lat,
      startLng: p.lng,
      endLat: next.lat,
      endLng: next.lng,
      pinLat,
      pinLng,
      totalShotsOnHole: total,
      par,
    }
    const inferred: InferredShot = inferShot(placed)
    rows.push({
      shotNumber: idx + 1,
      club: inferred.suggestedClub,
      lieType: inferred.suggestedLieType,
      startLat: p.lat,
      startLng: p.lng,
      endLat: next.lat,
      endLng: next.lng,
      distanceYards: inferred.distanceYards,
      distanceToPin: inferred.distanceToPin,
      isLastShot: inferred.isLastShot,
      // Default the last-putt to "made" because the player completed the
      // hole — they almost always did make it. They can toggle off if not.
      puttMade:
        inferred.isLastShot && inferred.suggestedLieType === 'green'
          ? true
          : undefined,
    })
  })
  return rows
}
