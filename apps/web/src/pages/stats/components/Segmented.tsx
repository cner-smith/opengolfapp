// A paper rocker (mobile Paper.tsx Rocker): one object, the chosen half
// pressed in, the others standing proud on their ink ledge.
export function Segmented<T extends number | string>({
  value,
  options,
  onChange,
  renderLabel,
  label,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  renderLabel: (v: T) => string
  label?: string
}) {
  return (
    <div className="st-rocker" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          aria-pressed={opt === value}
          onClick={() => onChange(opt)}
        >
          {renderLabel(opt)}
        </button>
      ))}
    </div>
  )
}
