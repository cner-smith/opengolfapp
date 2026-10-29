import type { ReactNode } from 'react'
import { shotPickerClubGroups, splitBalancedRows } from '@oga/core'
import { Rocker } from '../../ui/Rocker'

// Shot-editor fields, ported from mobile's components/paper/Pickers.tsx
// (#611 §19.9 "P2: grouped rockers").

export function NumericInput({
  value,
  step,
  label,
  onChange,
}: {
  value: number | undefined
  step?: string
  label: string
  onChange: (n: number | undefined) => void
}) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={value ?? ''}
      aria-label={label}
      onChange={(e) =>
        onChange(e.target.value ? Number(e.target.value) : undefined)
      }
      className="font-serif tabular text-caddie-ink"
      style={{
        background: '#FBF8F1',
        border: '1px solid #1C211C',
        borderRadius: 3,
        minHeight: 44,
        padding: '0 12px',
        fontSize: 17,
        fontWeight: 500,
        width: 120,
      }}
    />
  )
}

// A field head: Fraunces-italic title (with an optional dim aside), then its
// rows, a 1px rule above.
export function PickerField({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={{ display: 'grid', gap: 8, padding: '12px 0', borderTop: '1px solid #D9D2BF' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="serif-italic text-caddie-ink" style={{ fontSize: 16 }}>
          {title}
        </span>
        {aside}
      </div>
      {children}
    </div>
  )
}

// A group label (Epilogue 12, 52 wide) left of its control.
export function PickerRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="text-caddie-ink" style={{ width: 52, flexShrink: 0, fontSize: 12 }}>
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// A rocker split into balanced rows when it's wide, with an optional row
// label (omit it when the field title already names the choice). Tapping
// the chosen segment clears it.
export function RockerRows<T extends string | number>({
  name,
  label,
  options,
  value,
  onChange,
}: {
  /** Accessible name of the group. */
  name: string
  label?: string
  options: readonly { value: T; label: string }[]
  value: T | null | undefined
  onChange: (v: T | null) => void
}) {
  return (
    <>
      {splitBalancedRows(options).map((row, i) => {
        const rocker = (
          <Rocker
            label={name}
            options={row}
            value={value ?? null}
            onChange={onChange}
            onClear={() => onChange(null)}
            className="rocker-tight"
          />
        )
        return label === undefined ? (
          <div key={i}>{rocker}</div>
        ) : (
          <PickerRow key={i} label={i === 0 ? label : ''}>
            {rocker}
          </PickerRow>
        )
      })}
    </>
  )
}

// Club picker (§19.9), grouped by core shotPickerClubGroups.
export function ClubPicker({
  clubs,
  value,
  onChange,
}: {
  /** The bag in formatClubLabel order, labels already formatted. */
  clubs: { value: string; label: string }[]
  value: string | undefined
  onChange: (v: string | null) => void
}) {
  const groups = shotPickerClubGroups(clubs)
  return (
    <>
      {groups.map((g) => (
        <RockerRows key={g.label} name={`Club, ${g.label.toLowerCase()}`} label={g.label} options={g.opts} value={value} onChange={onChange} />
      ))}
    </>
  )
}
