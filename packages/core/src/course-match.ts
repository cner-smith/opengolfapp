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

// US state / territory full-name → 2-letter code. Our DB stores the corrected
// 2-letter form (Natural Earth) while OpenGolfAPI may return a full name
// ("Oklahoma"), so normalize both sides to the code before comparing —
// otherwise "Oklahoma" vs "OK" reads as a state conflict and a real duplicate
// slips through. Unknown/foreign values pass through as their lowercased self.
const STATE_ABBR: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca',
  colorado: 'co', connecticut: 'ct', delaware: 'de', 'district of columbia': 'dc',
  florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id', illinois: 'il',
  indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky', louisiana: 'la',
  maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi',
  minnesota: 'mn', mississippi: 'ms', missouri: 'mo', montana: 'mt',
  nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj',
  'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc',
  'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok', oregon: 'or',
  pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt',
  virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi',
  wyoming: 'wy', 'puerto rico': 'pr',
}

export function normalizeState(state: string | null | undefined): string {
  const s = (state ?? '').trim().toLowerCase()
  if (!s) return ''
  if (s.length === 2) return s
  return STATE_ABBR[s] ?? s
}

export function isProbableSameCourse(
  a: { name: string; state?: string | null; city?: string | null },
  b: { name: string; state?: string | null; city?: string | null },
): boolean {
  const na = normalizeCourseName(a.name)
  const nb = normalizeCourseName(b.name)
  if (!na || !nb) return false
  if (na !== nb) return false
  // Names match; only reject on a field BOTH sides carry and disagree on.
  // City matters most on the import path: generic names ("Riverside Golf
  // Club") repeat within a state, so without a city check a user importing
  // course B could be silently reused into unrelated course A's holes/tees.
  const sa = normalizeState(a.state)
  const sb = normalizeState(b.state)
  if (sa && sb && sa !== sb) return false
  const ca = (a.city ?? '').trim().toLowerCase()
  const cb = (b.city ?? '').trim().toLowerCase()
  if (ca && cb && ca !== cb) return false
  return true
}
