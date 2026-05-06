export function Segmented<T extends number | string>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  renderLabel: (v: T) => string
}) {
  return (
    <div
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        display: 'inline-flex',
      }}
    >
      {options.map((opt, i) => {
        const active = opt === value
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              backgroundColor: active ? '#1F3D2C' : 'transparent',
              color: active ? '#F2EEE5' : '#5C6356',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid #D9D2BF',
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              letterSpacing: '0.02em',
              cursor: 'pointer',
            }}
          >
            {renderLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}
