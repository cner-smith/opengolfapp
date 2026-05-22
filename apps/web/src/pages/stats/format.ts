// Formatters — never return NaN/undefined to the DOM.

export function fmtNumber(v: number | null, digits: number): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

export function fmtInt(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.round(v).toString()
}

export function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(0)}%`
}
