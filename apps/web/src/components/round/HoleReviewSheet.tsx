import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_BAG,
  LIE_TYPES,
  LIE_TYPE_LABELS,
  LIE_SLOPES_FORWARD,
  LIE_SLOPES_SIDE,
  SHOT_RESULTS,
  SHOT_RESULT_LABELS,
  buildInitialRows,
  combinedBreakDirection,
  formatClubLabel,
  haversineYards,
  horizontalBreakFromAim,
  isPuttEntry,
  isPuttShot,
  tourMakePercent,
  type BreakDirectionHorizontal,
  type BreakDirectionVertical,
  type Club,
  type GreenSpeed,
  type LieType,
  type LieSlopeForward,
  type LieSlopeSide,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ReviewedShotRow,
  type ShotResult,
} from '@oga/core'
import { GreenDiagram } from './GreenDiagram'
import type { PlacedPoint } from './RoundMap'
import type { WebPuttData } from './WebPuttingSheet'
import { useUnits } from '../../hooks/useUnits'
import { useUserBag } from '../../hooks/useUserBag'

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
  saving: boolean
  /** "Edit on map" — close the sheet and let the user drag markers. */
  onEditOnMap: () => void
  onSave: (
    rows: ReviewedShotRow[],
    summary: { score: number; putts: number; penalties: number },
  ) => void | Promise<void>
}

const PUTT_DISTANCE_OPTIONS: { value: PuttDistanceResult; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
]

const PUTT_DIRECTION_OPTIONS: {
  value: PuttDirectionResult
  label: string
}[] = [
  { value: 'left', label: 'Missed left' },
  { value: 'right', label: 'Missed right' },
]

// Putt read vocab — mirrors WebPuttingSheet so the summary and the old
// sheet stay in sync. Break line = the horizontal read, slope = up/down.
const BREAK_LINE_OPTIONS: { value: BreakDirectionHorizontal; label: string }[] = [
  { value: 'left_to_right', label: 'L → R' },
  { value: 'right_to_left', label: 'R → L' },
  { value: 'straight', label: 'Straight' },
]
const BREAK_SLOPE_OPTIONS: { value: BreakDirectionVertical; label: string }[] = [
  { value: 'uphill', label: 'Uphill' },
  { value: 'flat', label: 'Level' },
  { value: 'downhill', label: 'Downhill' },
]
const SPEED_OPTIONS: { value: GreenSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

export function HoleReviewSheet({
  open,
  holeNumber,
  par,
  pinLat,
  pinLng,
  placedPoints,
  placedPutts,
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
    setRows(merged)
    setScore(merged.length)
    // Putt TALLY counts any green-lie shot (isPuttShot), matching the SG
    // putting engine + putt-count readers — a bladed wedge on the green still
    // counts as a putt here even though its row shows normal-shot UI (the
    // per-row isPutt gate below stays isPuttEntry). User-overridable ticker.
    setPutts(merged.filter((r) => isPuttShot(r.lieType)).length)
    setPenalties(0)
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
              onChange={(next) =>
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
              }
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

function ShotRow({
  row,
  onChange,
  onOpenAimer,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
  /** Open the full-sheet green aimer for this putt row. */
  onOpenAimer: () => void
}) {
  // Mirror mobile's PUTTING_RADIUS_YARDS — any shot starting within 30 yd
  // of the pin gets the putt entry surface (made/short/long, miss left/
  // right, distance in feet) rather than the standard club + lie row.
  // Putt-ness is the green lie only (set when a putt is placed). Raw
  // distance must NOT classify: a chip/bunker inside 30 yd is not a putt,
  // and unmapped rows read distanceToPin 0 (#660).
  const isPutt = isPuttEntry(row.lieType, row.club)
  // Tour make-% readout (#791 step 4) — parity with mobile's putting sheet.
  // Only meaningful with a real distance (0 = no pin known).
  const puttTourPct =
    isPutt && row.distanceYards > 0
      ? tourMakePercent(row.distanceYards * 3)
      : null
  const { toDisplay, toDisplayFt } = useUnits()
  const { bag } = useUserBag()
  // Source the club options from the user's bag, falling back to
  // DEFAULT_BAG when empty/loading. Splice in the row's current `club`
  // when it isn't represented (custom utility club types from a bag
  // edit, or a legacy CLUBS-based row from before this PR) so the
  // <select> always shows the value the user actually has. Labels
  // route through `formatClubLabel` so a custom_wedge entry reads as
  // its loft (e.g. "58°") rather than the raw "custom_wedge" key, and
  // a bag with two of the same `club_type` (e.g. 58° + 60° lobs)
  // disambiguates by loft.
  const clubOptions = useMemo<{ value: string; label: string }[]>(() => {
    const source = bag.length > 0 ? bag : DEFAULT_BAG
    const typeCounts = new Map<string, number>()
    for (const c of source) {
      typeCounts.set(c.club_type, (typeCounts.get(c.club_type) ?? 0) + 1)
    }
    const base = source.map((c) => ({
      value: c.club_type,
      label: formatClubLabel(c, {
        hasDuplicateType: (typeCounts.get(c.club_type) ?? 0) > 1,
      }),
    }))
    if (row.club && !base.some((o) => o.value === row.club)) {
      return [{ value: row.club, label: row.club }, ...base]
    }
    return base
  }, [bag, row.club])
  // Which field's options are unfolded inline (Version A). One at a time.
  const [open, setOpen] = useState<
    'club' | 'lie' | 'slope' | 'result' | 'break' | 'speed' | null
  >(null)
  const toggle = (
    f: 'club' | 'lie' | 'slope' | 'result' | 'break' | 'speed',
  ) => setOpen((o) => (o === f ? null : f))
  // Chip labels are Sentence case across lie/slope/result; formatClubLabel
  // returns lowercase golf shorthand ("driver", "8i", "pw"), so capitalize
  // the club chip to match. Digit-led codes ("8i", "3w") are unchanged.
  const rawClubLabel =
    clubOptions.find((c) => c.value === row.club)?.label ?? String(row.club)
  const clubLabel = rawClubLabel.charAt(0).toUpperCase() + rawClubLabel.slice(1)
  const slopeSet = row.lieSlopeForward != null || row.lieSlopeSide != null
  const slopeText = [
    row.lieSlopeForward && slopeLabel(row.lieSlopeForward),
    row.lieSlopeSide && slopeLabel(row.lieSlopeSide),
  ]
    .filter(Boolean)
    .join(' · ')
  // Putt read summary for the collapsed chips.
  const breakSet =
    row.breakDirectionHorizontal != null || row.breakDirectionVertical != null
  const breakText = [
    BREAK_LINE_OPTIONS.find((o) => o.value === row.breakDirectionHorizontal)
      ?.label,
    BREAK_SLOPE_OPTIONS.find((o) => o.value === row.breakDirectionVertical)
      ?.label,
  ]
    .filter(Boolean)
    .join(' · ')
  const speedLabel =
    SPEED_OPTIONS.find((o) => o.value === row.greenSpeed)?.label ?? null
  const hasRead = row.aimOffsetInches != null && row.aimOffsetInches !== 0
  return (
    <div style={{ padding: '13px 0', borderBottom: '1px solid #D9D2BF' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 9,
        }}
      >
        <span className="kicker" style={{ color: '#8A8B7E' }}>
          Shot {row.shotNumber}
        </span>
        <span
          className="font-serif tabular text-caddie-ink"
          style={{ fontSize: 20, fontStyle: 'italic' }}
        >
          {isPutt
            ? `${toDisplayFt(row.distanceYards * 3)} putt`
            : toDisplay(row.distanceYards)}
        </span>
        {puttTourPct != null && (
          <span className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
            tour {puttTourPct}%
          </span>
        )}
        <span
          className="text-caddie-ink-mute"
          style={{ fontSize: 12, marginLeft: 'auto' }}
        >
          {toDisplay(row.distanceToPin)} to pin
        </span>
      </div>

      {isPutt ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FieldChip
              label={clubLabel}
              filled
              active={open === 'club'}
              onClick={() => toggle('club')}
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...row,
                  puttMade: !row.puttMade,
                  puttDistanceResult: !row.puttMade
                    ? undefined
                    : row.puttDistanceResult,
                  puttDirectionResult: !row.puttMade
                    ? undefined
                    : row.puttDirectionResult,
                })
              }
              aria-pressed={!!row.puttMade}
              style={{
                background: row.puttMade ? '#1F3D2C' : '#FBF8F1',
                color: row.puttMade ? '#F2EEE5' : '#1F3D2C',
                border: '1px solid #1F3D2C',
                borderRadius: 16,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {row.puttMade ? 'Made it ✓' : 'Made it'}
            </button>
            <FieldChip
              label={breakSet ? breakText : '+ break'}
              filled={breakSet}
              active={open === 'break'}
              onClick={() => toggle('break')}
            />
            <FieldChip
              label={speedLabel ?? '+ speed'}
              filled={!!speedLabel}
              active={open === 'speed'}
              onClick={() => toggle('speed')}
            />
            <FieldChip label="Read ▸" filled={hasRead} onClick={onOpenAimer} />
          </div>
          {open === 'club' && (
            <ChipExpand
              label="Club"
              options={clubOptions}
              value={row.club}
              onSelect={(v) => {
                onChange({ ...row, club: v as Club })
                setOpen(null)
              }}
            />
          )}
          {open === 'break' && <BreakExpand row={row} onChange={onChange} />}
          {open === 'speed' && (
            <ChipExpand
              label="Speed"
              options={SPEED_OPTIONS}
              value={row.greenSpeed}
              onSelect={(v) => {
                onChange({
                  ...row,
                  greenSpeed: row.greenSpeed === v ? undefined : v,
                })
                setOpen(null)
              }}
            />
          )}
          {!row.puttMade && (
            <div style={{ marginTop: 10 }}>
              <PuttMissAxes row={row} onChange={onChange} />
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FieldChip
              label={clubLabel}
              filled
              active={open === 'club'}
              onClick={() => toggle('club')}
            />
            <FieldChip
              label={LIE_TYPE_LABELS[row.lieType]}
              filled
              active={open === 'lie'}
              onClick={() => toggle('lie')}
            />
            <FieldChip
              label={slopeSet ? slopeText : '+ slope'}
              filled={slopeSet}
              active={open === 'slope'}
              onClick={() => toggle('slope')}
            />
            <FieldChip
              label={
                row.shotResult
                  ? SHOT_RESULT_LABELS[row.shotResult]
                  : '+ result'
              }
              filled={!!row.shotResult}
              active={open === 'result'}
              onClick={() => toggle('result')}
            />
          </div>
          {open === 'club' && (
            <ChipExpand
              label="Club"
              options={clubOptions}
              value={row.club}
              onSelect={(v) => {
                onChange({ ...row, club: v as Club })
                setOpen(null)
              }}
            />
          )}
          {open === 'lie' && (
            <ChipExpand
              label="Lie"
              options={LIE_TYPES.map((l) => ({
                value: l,
                label: LIE_TYPE_LABELS[l],
              }))}
              value={row.lieType}
              onSelect={(v) => {
                onChange({ ...row, lieType: v as LieType })
                setOpen(null)
              }}
            />
          )}
          {open === 'slope' && <SlopeExpand row={row} onChange={onChange} />}
          {open === 'result' && (
            <ChipExpand
              label="Result"
              options={SHOT_RESULTS.map((r) => ({
                value: r,
                label: SHOT_RESULT_LABELS[r],
              }))}
              value={row.shotResult}
              onSelect={(v) => {
                onChange({
                  ...row,
                  shotResult:
                    row.shotResult === v ? undefined : (v as ShotResult),
                })
                setOpen(null)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

// 'ball_above' → 'Ball above', 'uphill' → 'Uphill'.
function slopeLabel(v: string): string {
  const s = v.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// A field entry on a shot row: filled (forest), blank ("+ field", dashed), or
// active (unfolded — light forest). Tapping unfolds/collapses its options.
function FieldChip({
  label,
  filled,
  active,
  onClick,
}: {
  label: string
  filled?: boolean
  active?: boolean
  onClick: () => void
}) {
  const bg = active ? '#E6EDE6' : filled ? '#1F3D2C' : 'transparent'
  const color = active ? '#1F3D2C' : filled ? '#F2EEE5' : '#8A8B7E'
  const border = active || filled ? '#1F3D2C' : '#9F9580'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      style={{
        fontFamily: 'inherit',
        fontSize: 12,
        padding: '5px 11px',
        borderRadius: 16,
        cursor: 'pointer',
        border: `1px ${filled || active ? 'solid' : 'dashed'} ${border}`,
        background: bg,
        color,
      }}
    >
      {label}
      {active ? ' ▾' : ''}
    </button>
  )
}

function OptChip({
  label,
  on,
  onClick,
}: {
  label: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        fontFamily: 'inherit',
        fontSize: 11,
        padding: '4px 10px',
        borderRadius: 14,
        cursor: 'pointer',
        border: `1px solid ${on ? '#1F3D2C' : '#D9D2BF'}`,
        background: on ? '#1F3D2C' : '#F2EEE5',
        color: on ? '#F2EEE5' : '#1C211C',
      }}
    >
      {label}
    </button>
  )
}

// Inline unfolded options for a single-select field (club / lie / result).
function ChipExpand<V extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string
  options: { value: V; label: string }[]
  value: V | undefined
  onSelect: (v: V) => void
}) {
  return (
    <div
      style={{
        marginTop: 9,
        background: '#EBE5D6',
        borderRadius: 8,
        padding: '9px 10px',
      }}
    >
      <div className="kicker" style={{ color: '#8A8B7E', marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => (
          <OptChip
            key={o.value}
            label={o.label}
            on={o.value === value}
            onClick={() => onSelect(o.value)}
          />
        ))}
      </div>
    </div>
  )
}

// The two-axis slope grid (uphill/level/downhill × ball above/below), unfolded
// inline. Each axis toggles independently; either can stay unset.
function SlopeExpand({
  row,
  onChange,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
}) {
  return (
    <div
      style={{
        marginTop: 9,
        background: '#EBE5D6',
        borderRadius: 8,
        padding: '9px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <div>
        <div className="kicker" style={{ color: '#8A8B7E', marginBottom: 6 }}>
          Uphill / downhill
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {LIE_SLOPES_FORWARD.map((f) => (
            <OptChip
              key={f}
              label={slopeLabel(f)}
              on={row.lieSlopeForward === f}
              onClick={() =>
                onChange({
                  ...row,
                  lieSlopeForward:
                    row.lieSlopeForward === f
                      ? undefined
                      : (f as LieSlopeForward),
                })
              }
            />
          ))}
        </div>
      </div>
      <div>
        <div className="kicker" style={{ color: '#8A8B7E', marginBottom: 6 }}>
          Ball above / below
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {LIE_SLOPES_SIDE.map((s) => (
            <OptChip
              key={s}
              label={slopeLabel(s)}
              on={row.lieSlopeSide === s}
              onClick={() =>
                onChange({
                  ...row,
                  lieSlopeSide:
                    row.lieSlopeSide === s ? undefined : (s as LieSlopeSide),
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// The putt break read, unfolded inline: line (L→R / R→L / straight) + slope
// (uphill / level / downhill). Each axis toggles independently.
function BreakExpand({
  row,
  onChange,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
}) {
  return (
    <div
      style={{
        marginTop: 9,
        background: '#EBE5D6',
        borderRadius: 8,
        padding: '9px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <div>
        <div className="kicker" style={{ color: '#8A8B7E', marginBottom: 6 }}>
          Break — which way
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BREAK_LINE_OPTIONS.map((o) => (
            <OptChip
              key={o.value}
              label={o.label}
              on={row.breakDirectionHorizontal === o.value}
              onClick={() =>
                onChange({
                  ...row,
                  breakDirectionHorizontal:
                    row.breakDirectionHorizontal === o.value
                      ? undefined
                      : o.value,
                })
              }
            />
          ))}
        </div>
      </div>
      <div>
        <div className="kicker" style={{ color: '#8A8B7E', marginBottom: 6 }}>
          Slope
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BREAK_SLOPE_OPTIONS.map((o) => (
            <OptChip
              key={o.value}
              label={o.label}
              on={row.breakDirectionVertical === o.value}
              onClick={() =>
                onChange({
                  ...row,
                  breakDirectionVertical:
                    row.breakDirectionVertical === o.value
                      ? undefined
                      : o.value,
                })
              }
            />
          ))}
        </div>
      </div>
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

function PuttMissAxes({
  row,
  onChange,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        marginLeft: 0,
      }}
    >
      <AxisRow
        label="Distance"
        options={PUTT_DISTANCE_OPTIONS}
        value={row.puttDistanceResult}
        onSelect={(v) =>
          onChange({
            ...row,
            puttDistanceResult:
              row.puttDistanceResult === v ? undefined : v,
          })
        }
      />
      <AxisRow
        label="Direction"
        options={PUTT_DIRECTION_OPTIONS}
        value={row.puttDirectionResult}
        onSelect={(v) =>
          onChange({
            ...row,
            puttDirectionResult:
              row.puttDirectionResult === v ? undefined : v,
          })
        }
      />
    </div>
  )
}

function AxisRow<V extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string
  options: { value: V; label: string }[]
  value: V | undefined
  onSelect: (v: V) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      <span
        className="kicker"
        style={{ minWidth: 72, color: '#5C6356' }}
      >
        {label}
      </span>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            aria-pressed={active}
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
  )
}

