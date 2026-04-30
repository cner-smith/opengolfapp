import type { LieSlopeForward, LieSlopeSide } from '@oga/core'

const FORWARD_ROW: LieSlopeForward[] = ['uphill', 'level', 'downhill']
const SIDE_ROW: (LieSlopeSide | 'spacer')[] = ['ball_above', 'spacer', 'ball_below']

const FORWARD_LABEL: Record<LieSlopeForward, string> = {
  uphill: 'Uphill',
  level: 'Level',
  downhill: 'Downhill',
}

const SIDE_LABEL: Record<LieSlopeSide, string> = {
  ball_above: 'Ball above',
  ball_below: 'Ball below',
}

interface Props {
  forward: LieSlopeForward | undefined
  side: LieSlopeSide | undefined
  onChangeForward: (v: LieSlopeForward | undefined) => void
  onChangeSide: (v: LieSlopeSide | undefined) => void
  /** When true, clicking the active cell clears it (filter context). */
  toggleable?: boolean
}

export function LieSlopeGrid({
  forward,
  side,
  onChangeForward,
  onChangeSide,
  toggleable = false,
}: Props) {
  return (
    <div
      className="grid grid-cols-3"
      style={{ gap: 6, maxWidth: 360 }}
    >
      <div role="radiogroup" aria-label="Forward slope" style={{ display: 'contents' }}>
        {FORWARD_ROW.map((key) => {
          const active = forward === key
          return (
            <Cell
              key={key}
              role="radio"
              active={active}
              label={FORWARD_LABEL[key]}
              icon={<ForwardIcon kind={key} active={active} />}
              onClick={() =>
                onChangeForward(toggleable && active ? undefined : key)
              }
            />
          )
        })}
      </div>
      <div role="radiogroup" aria-label="Side slope" style={{ display: 'contents' }}>
        {SIDE_ROW.map((key, i) => {
          if (key === 'spacer') return <div key={`s${i}`} />
          const active = side === key
          return (
            <Cell
              key={key}
              role="radio"
              active={active}
              label={SIDE_LABEL[key]}
              icon={<SideIcon kind={key} active={active} />}
              onClick={() =>
                onChangeSide(toggleable && active ? undefined : key)
              }
            />
          )
        })}
      </div>
    </div>
  )
}

function Cell({
  active,
  label,
  icon,
  onClick,
  role,
}: {
  active: boolean
  label: string
  icon: React.ReactNode
  onClick: () => void
  role?: string
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={active}
      onClick={onClick}
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
      {icon}
      <span>{label}</span>
    </button>
  )
}

const ICON_PROPS = {
  width: 32,
  height: 24,
  viewBox: '0 0 32 24',
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
}

function ForwardIcon({
  kind,
  active,
}: {
  kind: LieSlopeForward
  active: boolean
}) {
  const stroke = active ? '#F2EEE5' : '#5C6356'
  switch (kind) {
    case 'uphill':
      // Line tilts up left to right; ball at the low (left) end.
      return (
        <svg {...ICON_PROPS} stroke={stroke}>
          <line x1={4} y1={18} x2={28} y2={6} />
          <circle cx={6} cy={15} r={2} fill={stroke} stroke="none" />
        </svg>
      )
    case 'level':
      return (
        <svg {...ICON_PROPS} stroke={stroke}>
          <line x1={4} y1={16} x2={28} y2={16} />
          <circle cx={16} cy={12} r={2} fill={stroke} stroke="none" />
        </svg>
      )
    case 'downhill':
      // Line tilts down left to right; ball at the low (right) end.
      return (
        <svg {...ICON_PROPS} stroke={stroke}>
          <line x1={4} y1={6} x2={28} y2={18} />
          <circle cx={26} cy={15} r={2} fill={stroke} stroke="none" />
        </svg>
      )
  }
}

function SideIcon({
  kind,
  active,
}: {
  kind: LieSlopeSide
  active: boolean
}) {
  const stroke = active ? '#F2EEE5' : '#5C6356'
  if (kind === 'ball_above') {
    return (
      <svg {...ICON_PROPS} stroke={stroke}>
        <line x1={4} y1={18} x2={28} y2={18} />
        <circle cx={16} cy={8} r={2} fill={stroke} stroke="none" />
      </svg>
    )
  }
  return (
    <svg {...ICON_PROPS} stroke={stroke}>
      <line x1={4} y1={8} x2={28} y2={8} />
      <circle cx={16} cy={18} r={2} fill={stroke} stroke="none" />
    </svg>
  )
}
