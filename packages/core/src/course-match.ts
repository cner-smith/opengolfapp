// Fuzzy course-name matching for de-duplicating OpenGolfAPI search hits and
// imports against courses we already have. OpenGolfAPI returns no coordinates,
// so matching is normalized-name + state only — deliberately best-effort.

// Words that carry no identifying signal for a golf course name. Stripped so
// "Lake Hefner Golf Club" and "Lake Hefner Golf Course" collapse to the same key.
const NOISE_WORDS = new Set([
  'golf', 'course', 'club', 'links', 'country', 'the', 'at', 'and', 'cc', 'gc',
])

export function normalizeCourseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w))
    .join(' ')
    .trim()
}

export function isProbableSameCourse(
  a: { name: string; state?: string | null },
  b: { name: string; state?: string | null },
): boolean {
  const na = normalizeCourseName(a.name)
  const nb = normalizeCourseName(b.name)
  if (!na || !nb) return false
  if (na !== nb) return false
  // Names match; only reject if BOTH sides name a state and they disagree.
  const sa = (a.state ?? '').trim().toLowerCase()
  const sb = (b.state ?? '').trim().toLowerCase()
  if (sa && sb && sa !== sb) return false
  return true
}
