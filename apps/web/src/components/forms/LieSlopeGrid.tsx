import type { LieSlope } from '@oga/core'

type SlopeKey = LieSlope | 'spacer'

const SLOPE_GRID: SlopeKey[] = [
  'uphill',
  'level',
  'downhill',
  'ball_above',
  'spacer',
  'ball_below',
]

const LABEL: Record<LieSlope, string> = {
  uphill: 'Uphill',
  level: 'Level',
  downhill: 'Downhill',
  ball_above: 'Ball above',
  ball_below: 'Ball below',
}

interface Props {
  value: LieSlope | undefined
  // Pass a (LieSlope | undefined) signature to allow click-to-clear (filter
  // contexts). Pass a (LieSlope) signature to enforce always-set radio
  // behavior (shot-entry contexts).
  onChange: (v: LieSlope | undefined) => void
  toggleable?: boolean
}

export function LieSlopeGrid({ value, onChange, toggleable = false }: Props) {
  return (
    <div
      role="radiogroup"
      className="grid grid-cols-3"
      style={{ gap: 6, maxWidth: 360 }}
    >
      {SLOPE_GRID.map((key, i) => {
        if (key === 'spacer') return <div key={`s${i}`} />
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(toggleable && active ? undefined : key)}
            style={{
              backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
              color: active ? '#F2EEE5' : '#1C211C',
              border: 'none',
              borderRadius: 2,
              padding: '12px 8px',
              fontSize: 12,
              fontWeight: active ? 500 : 400,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <SlopeIcon kind={key} color={active ? '#F2EEE5' : '#5C6356'} />
            <span>{LABEL[key]}</span>
          </button>
        )
      })}
    </div>
  )
}

function SlopeIcon({ kind, color }: { kind: LieSlope; color: string }) {
  const props = {
    width: 32,
    height: 24,
    viewBox: '0 0 32 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
  }
  switch (kind) {
    case 'uphill':
      // Line tilts up left to right; ball at the low (left) end.
      return (
        <svg {...props}>
          <line x1={4} y1={18} x2={28} y2={6} />
          <circle cx={6} cy={15} r={2} fill={color} stroke="none" />
        </svg>
      )
    case 'level':
      // Horizontal line; ball centred above.
      return (
        <svg {...props}>
          <line x1={4} y1={16} x2={28} y2={16} />
          <circle cx={16} cy={12} r={2} fill={color} stroke="none" />
        </svg>
      )
    case 'downhill':
      // Line tilts down left to right; ball at the low (right) end.
      return (
        <svg {...props}>
          <line x1={4} y1={6} x2={28} y2={18} />
          <circle cx={26} cy={15} r={2} fill={color} stroke="none" />
        </svg>
      )
    case 'ball_above':
      // Horizontal line; ball positioned above the line.
      return (
        <svg {...props}>
          <line x1={4} y1={18} x2={28} y2={18} />
          <circle cx={16} cy={8} r={2} fill={color} stroke="none" />
        </svg>
      )
    case 'ball_below':
      // Horizontal line; ball positioned below the line.
      return (
        <svg {...props}>
          <line x1={4} y1={8} x2={28} y2={8} />
          <circle cx={16} cy={18} r={2} fill={color} stroke="none" />
        </svg>
      )
  }
}
