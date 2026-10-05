import { useMemo, useState } from 'react'
import {
  DEFAULT_BAG,
  LIE_TYPES,
  LIE_TYPE_LABELS,
  LIE_SLOPES_FORWARD,
  LIE_SLOPES_SIDE,
  legacyShotResult,
  SHOT_CONTACT_LABELS,
  SHOT_SHAPE_LABELS,
  SHOT_START_LINE_LABELS,
  formatClubLabel,
  isPuttEntry,
  lieSlopeLabel,
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
} from '@oga/core'
import { useUnits } from '../../hooks/useUnits'
import { useUserBag } from '../../hooks/useUserBag'
import { ResultAxes } from '../rounds/shots/ResultAxes'

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

// Putt read vocab, matching mobile's review sheet. Break line = the
// horizontal read, slope = up/down.
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
export function ShotRow({
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
  const result = {
    contact: row.contact ?? null,
    shape: row.shape ?? null,
    startLine: row.startLine ?? null,
    penalty: !!row.penalty,
    ob: row.shotResult === 'ob',
  }
  const resultText = [
    result.contact && SHOT_CONTACT_LABELS[result.contact],
    result.shape && SHOT_SHAPE_LABELS[result.shape],
    result.startLine && SHOT_START_LINE_LABELS[result.startLine],
    result.penalty && 'Penalty',
    result.ob && 'OB',
  ]
    .filter(Boolean)
    .join(' · ')
  const slopeText = [
    row.lieSlopeForward && lieSlopeLabel(row.lieSlopeForward),
    row.lieSlopeSide && lieSlopeLabel(row.lieSlopeSide),
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
              label={resultText || '+ result'}
              filled={!!resultText}
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
            <div style={{ marginTop: 9, background: '#EBE5D6', borderRadius: 3, padding: '9px 10px' }}>
              <ResultAxes
                penaltyCountsStroke
                value={result}
                onChange={(v) =>
                  onChange({
                    ...row,
                    contact: v.contact,
                    shape: v.shape,
                    startLine: v.startLine,
                    penalty: v.penalty,
                    // The legacy value carries OB for the sheet's ticker and
                    // the save (`ob = shotResult === 'ob'`).
                    shotResult: legacyShotResult(v) ?? undefined,
                  })
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  )
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
        borderRadius: 3,
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
        borderRadius: 3,
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
              label={lieSlopeLabel(f)}
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
              label={lieSlopeLabel(s)}
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
        borderRadius: 3,
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
