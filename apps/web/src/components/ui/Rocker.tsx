import type { KeyboardEvent, ReactNode } from 'react'

// The paper rocker (.rocker in index.css). A radio group by default; `tabs`
// makes it a tablist for a control that swaps the panel below. Either way
// one stop in the tab order, arrow keys move the choice. With `onClear`,
// nothing need be chosen and tapping the chosen segment clears it.
export function Rocker<T extends string | number>({
  options,
  value,
  onChange,
  onClear,
  label,
  tabs,
  className,
}: {
  options: readonly { value: T; label: string; glyph?: ReactNode }[]
  value: T | null
  onChange: (v: T) => void
  onClear?: () => void
  label: string
  tabs?: boolean
  className?: string
}) {
  const chosen = options.findIndex((o) => o.value === value)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (Math.max(chosen, 0) + (chosen < 0 ? 0 : step) + options.length) % options.length
    onChange(options[next]!.value)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }
  return (
    <div
      role={tabs ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={className ? `rocker ${className}` : 'rocker'}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => {
        const on = i === chosen
        return (
          <button
            key={String(o.value)}
            type="button"
            role={tabs ? 'tab' : 'radio'}
            {...(tabs ? { 'aria-selected': on } : { 'aria-checked': on })}
            tabIndex={on || (chosen < 0 && i === 0) ? 0 : -1}
            onClick={() => (on && onClear ? onClear() : onChange(o.value))}
          >
            {o.glyph}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
