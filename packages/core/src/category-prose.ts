// UI safety net: rewrites raw snake_case category enums that leaked into
// displayed plan prose (coach note, focus reasons). `approach` / `putting`
// already read as words. Null / undefined degrade to empty text — a malformed
// plan must never crash the screen.
export function normalizeCategoryProse(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\boff_tee\b/gi, 'off the tee')
    .replace(/\baround_green\b/gi, 'around the green')
}
