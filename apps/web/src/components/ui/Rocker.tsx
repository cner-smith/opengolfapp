import type { KeyboardEvent } from 'react'

// The paper rocker (.rocker in index.css). A radio group by default; `tabs`
// makes it a tablist for a control that swaps the panel below. Either way
// one stop in the tab order, arrow keys move the choice.
export function Rocker<T extends string | number>({
  options,
  value,
  onChange,
  label,
  tabs,
  className,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
  tabs?: boolean
  className?: string
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const next = (i + step + options.length) % options.length
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
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role={tabs ? 'tab' : 'radio'}
            {...(tabs ? { 'aria-selected': on } : { 'aria-checked': on })}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
