import { useEffect, useState } from 'react'
import type { PuttDirectionResult, PuttDistanceResult } from '@oga/core'

export interface WebPuttData {
  puttMade: boolean
  puttDistanceFt: number | null
  puttDistanceResult?: PuttDistanceResult
  puttDirectionResult?: PuttDirectionResult
}

interface WebPuttingSheetProps {
  open: boolean
  shotNumber: number
  /** Distance from the placed start to the pin in feet, used to seed
   *  the distance input so the player only types in a correction. */
  initialDistanceFt: number
  initial?: WebPuttData | null
  onSave: (value: WebPuttData) => void
  onClose: () => void
}

const DISTANCE_OPTIONS: { value: PuttDistanceResult; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
]

const DIRECTION_OPTIONS: { value: PuttDirectionResult; label: string }[] = [
  { value: 'left', label: 'Missed left' },
  { value: 'right', label: 'Missed right' },
]

// Minimum distance in feet a recorded putt can be — sub-1 ft tap-ins
// stay at 1 ft so the SG baselines (which clamp to 3 ft anyway) get a
// non-zero start length and the distance input doesn't read "0".
const MIN_PUTT_FT = 1

export function WebPuttingSheet({
  open,
  shotNumber,
  initialDistanceFt,
  initial,
  onSave,
  onClose,
}: WebPuttingSheetProps) {
  const [distanceText, setDistanceText] = useState('')
  const [made, setMade] = useState<boolean>(false)
  const [distanceResult, setDistanceResult] = useState<
    PuttDistanceResult | undefined
  >()
  const [directionResult, setDirectionResult] = useState<
    PuttDirectionResult | undefined
  >()

  // Re-seed the form whenever a new putt is opened. `open + shotNumber`
  // is the right key — opening the sheet for shot 4 then shot 5 (without
  // closing in between) should restart the form from the new shot's
  // seed values, not retain shot 4's typed distance.
  useEffect(() => {
    if (!open) return
    const seed = initial ?? null
    setDistanceText(
      String(
        Math.max(
          MIN_PUTT_FT,
          seed?.puttDistanceFt ?? Math.round(initialDistanceFt),
        ),
      ),
    )
    setMade(seed?.puttMade ?? false)
    setDistanceResult(seed?.puttDistanceResult)
    setDirectionResult(seed?.puttDirectionResult)
  }, [open, shotNumber, initialDistanceFt, initial])

  function commit(makeOverride: boolean) {
    const parsed = Number(distanceText)
    const dist = Number.isFinite(parsed)
      ? Math.max(MIN_PUTT_FT, Math.round(parsed))
      : null
    onSave({
      puttMade: makeOverride,
      puttDistanceFt: dist,
      puttDistanceResult: makeOverride ? undefined : distanceResult,
      puttDirectionResult: makeOverride ? undefined : directionResult,
    })
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label={`Putt ${shotNumber}`}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        background: '#FBF8F1',
        borderTop: '1px solid #9F9580',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        padding: '8px 22px 18px',
        zIndex: 6,
        maxHeight: '80%',
        overflowY: 'auto',
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
          paddingBottom: 12,
          borderBottom: '1px solid #D9D2BF',
        }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>
            Putt {shotNumber}
          </div>
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic' }}
          >
            On the green.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            background: 'transparent',
            border: 'none',
            padding: 8,
          }}
        >
          Close
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="kicker">Distance (ft)</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_PUTT_FT}
            value={distanceText}
            onChange={(e) => setDistanceText(e.target.value)}
            className="bg-caddie-bg text-caddie-ink"
            style={{
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '10px 12px',
              fontSize: 15,
              width: 120,
            }}
          />
        </label>

        <Section title="Distance result">
          <RowChips
            options={DISTANCE_OPTIONS}
            value={made ? undefined : distanceResult}
            disabled={made}
            onSelect={(v) => {
              setMade(false)
              setDistanceResult((cur) => (cur === v ? undefined : v))
            }}
          />
        </Section>

        <Section title="Direction">
          <RowChips
            options={DIRECTION_OPTIONS}
            value={made ? undefined : directionResult}
            disabled={made}
            onSelect={(v) => {
              setMade(false)
              setDirectionResult((cur) => (cur === v ? undefined : v))
            }}
          />
        </Section>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 18,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => commit(true)}
          className="bg-caddie-accent text-caddie-accent-ink"
          style={{
            flex: 1,
            minWidth: 160,
            borderRadius: 2,
            padding: '14px 18px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          Holed it{' '}
          <span className="font-serif" style={{ fontStyle: 'italic' }}>
            →
          </span>
        </button>
        <button
          type="button"
          onClick={() => commit(false)}
          className="text-caddie-accent"
          style={{
            flex: 1,
            minWidth: 140,
            border: '1px solid #1F3D2C',
            background: 'transparent',
            borderRadius: 2,
            padding: '14px 18px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          Missed{' '}
          <span className="font-serif" style={{ fontStyle: 'italic' }}>
            →
          </span>
        </button>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function RowChips<V extends string>({
  options,
  value,
  disabled,
  onSelect,
}: {
  options: { value: V; label: string }[]
  value: V | undefined
  disabled?: boolean
  onSelect: (v: V) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = !disabled && value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            disabled={disabled}
            aria-pressed={active}
            style={{
              background: active ? '#1F3D2C' : '#EBE5D6',
              color: active ? '#F2EEE5' : '#1C211C',
              border: 'none',
              borderRadius: 2,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
