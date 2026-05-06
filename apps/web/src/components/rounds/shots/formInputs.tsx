import type { ReactNode } from 'react'

export function NumericInput({
  value,
  step,
  onChange,
}: {
  value: number | undefined
  step?: string
  onChange: (n: number | undefined) => void
}) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={value ?? ''}
      onChange={(e) =>
        onChange(e.target.value ? Number(e.target.value) : undefined)
      }
      className="font-serif tabular text-caddie-ink bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: '8px 10px',
        fontSize: 17,
        fontWeight: 500,
        width: 140,
      }}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export interface ChipGroupProps<T extends string> {
  value: T | undefined
  options: readonly { value: T; label: string }[]
  onChange: (v: T | undefined) => void
}

export function chipStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
    color: active ? '#F2EEE5' : '#1C211C',
    border: 'none',
    borderRadius: 2,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
  }
}

export function ChipGroup<T extends string>({ value, options, onChange }: ChipGroupProps<T>) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {options.map(({ value: optValue, label }) => (
        <button
          key={optValue}
          type="button"
          onClick={() => onChange(value === optValue ? undefined : optValue)}
          style={chipStyle(value === optValue)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function PuttResultButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        backgroundColor: active ? '#1F3D2C' : '#FBF8F1',
        color: active ? '#F2EEE5' : '#1C211C',
        border: `1px solid ${active ? '#1F3D2C' : '#D9D2BF'}`,
        borderRadius: 2,
        padding: '14px 10px',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}
