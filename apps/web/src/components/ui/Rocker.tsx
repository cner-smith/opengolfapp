import type { KeyboardEvent, ReactNode } from 'react'

// The paper rocker (.rocker in index.css). A radio group by default; `tabs`
// makes it a tablist for a control that swaps the panel below. Either way
// one stop in the tab order, arrow keys move the choice. With `onClear`,
// nothing need be chosen and tapping the chosen segment clears it. A
// `disabled` option shows greyed and is skipped by the arrow keys.
export function Rocker<T extends string | number>({
  options,
  value,
  onChange,
  onClear,
  label,
  tabs,
  className,
}: {
  options: readonly { value: T; label: string; glyph?: ReactNode; disabled?: boolean }[]
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
    // Nothing chosen: Right/Down picks the first option, Left/Up the last.
    let next = chosen < 0 ? (step > 0 ? 0 : options.length - 1) : (chosen + step + options.length) % options.length
    for (let n = 0; options[next]!.disabled && n < options.length; n++) next = (next + step + options.length) % options.length
    if (options[next]!.disabled) return
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
            disabled={o.disabled}
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
