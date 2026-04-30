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

interface HoleReviewSheetProps {
  open: boolean
  holeNumber: number
  par: number
  totalPar: number
  pinLat: number | null
  pinLng: number | null
  teeLat: number | null
  teeLng: number | null
  placedPoints: PlacedPoint[]
  saving: boolean
  onCancel: () => void
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
}

export function HoleReviewSheet({
  open,
  holeNumber,
  par,
  pinLat,
  pinLng,
  teeLat,
  teeLng,
  placedPoints,
  saving,
  onCancel,
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
    setRows(buildInitialRows(placedPoints, par, pinLat, pinLng, teeLat, teeLng))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, holeNumber, placedPoints.length])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(28,33,28,0.45)' }}
    >
      <div
        className="bg-caddie-surface w-full"
        style={{
          maxWidth: 720,
          maxHeight: '85vh',
          borderTop: '1px solid #9F9580',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '18px 22px 14px',
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
          <button
            type="button"
            onClick={onCancel}
            className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              padding: '6px 8px',
              background: 'transparent',
              border: 'none',
            }}
          >
            Edit on map
          </button>
        </div>

        <div
          style={{
            overflowY: 'auto',
            padding: '4px 22px 14px',
            flex: 1,
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
            padding: '14px 22px 22px',
            borderTop: '1px solid #D9D2BF',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
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
  const isPutt = row.lieType === 'green'
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
          ? `${Math.round(row.distanceYards * 3)} ft putt`
          : `${Math.round(row.distanceYards)} yd`}
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
      <span
        className="text-caddie-ink-mute"
        style={{ fontSize: 12, marginLeft: 'auto' }}
      >
        {Math.round(row.distanceToPin)} yd to pin
      </span>
    </div>
  )
}

function buildInitialRows(
  points: PlacedPoint[],
  par: number,
  pinLat: number,
  pinLng: number,
  teeLat: number | null,
  teeLng: number | null,
): ReviewedShotRow[] {
  const total = points.length
  const rows: ReviewedShotRow[] = []
  let prev: { lat: number; lng: number } | null =
    teeLat != null && teeLng != null ? { lat: teeLat, lng: teeLng } : null
  points.forEach((p, idx) => {
    const placed: PlacedShot = {
      shotNumber: idx + 1,
      lat: p.lat,
      lng: p.lng,
      prevLat: prev?.lat,
      prevLng: prev?.lng,
      pinLat,
      pinLng,
      teeLat: teeLat ?? p.lat,
      teeLng: teeLng ?? p.lng,
      totalShotsOnHole: total,
      par,
    }
    const inferred: InferredShot = inferShot(placed)
    rows.push({
      shotNumber: idx + 1,
      club: inferred.suggestedClub,
      lieType: inferred.suggestedLieType,
      startLat: prev?.lat ?? null,
      startLng: prev?.lng ?? null,
      endLat: p.lat,
      endLng: p.lng,
      distanceYards: inferred.distanceYards,
      distanceToPin: inferred.distanceToPin,
    })
    prev = { lat: p.lat, lng: p.lng }
  })
  return rows
}
