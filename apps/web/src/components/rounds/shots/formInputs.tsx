import type { ReactNode } from 'react'
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

const MAX_PER_ROW = 5

// Balanced rows, never one segment left over: ceil(n / rows) each.
function splitRows<T>(items: readonly T[]): T[][] {
  if (items.length <= MAX_PER_ROW) return [[...items]]
  const rows = Math.ceil(items.length / MAX_PER_ROW)
  const per = Math.ceil(items.length / rows)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per))
  return out
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
      {splitRows(options).map((row, i) => {
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

const WOOD = /^(driver|\d+w|\d+h)$/
const IRON = /^\d+i$/

// Club picker (§19.9): Woods (driver, woods and hybrids) · Irons · Wedges (and
// putter). A group never renders as one lonely segment — it folds into its
// neighbour.
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
  const groups: { label: string; opts: { value: string; label: string }[] }[] = [
    { label: 'Woods', opts: clubs.filter((c) => WOOD.test(c.value)) },
    { label: 'Irons', opts: clubs.filter((c) => IRON.test(c.value)) },
    { label: 'Wedges', opts: clubs.filter((c) => !WOOD.test(c.value) && !IRON.test(c.value)) },
  ].filter((g) => g.opts.length > 0)
  for (let i = 0; i < groups.length && groups.length > 1; i++) {
    const g = groups[i]!
    if (g.opts.length !== 1) continue
    const into = groups[i + 1] ?? groups[i - 1]!
    into.opts = i + 1 < groups.length ? [...g.opts, ...into.opts] : [...into.opts, ...g.opts]
    groups.splice(i, 1)
    i--
  }
  return (
    <>
      {groups.map((g) => (
        <RockerRows key={g.label} name={`Club, ${g.label.toLowerCase()}`} label={g.label} options={g.opts} value={value} onChange={onChange} />
      ))}
    </>
  )
}
