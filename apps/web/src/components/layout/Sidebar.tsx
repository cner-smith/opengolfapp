import { NavLink } from 'react-router-dom'
import { HANDICAP_PROVENANCE_LABEL } from '@oga/core'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../../hooks/useProfile'
import { useHandicapMeta } from '../../hooks/useHandicapMeta'

interface NavLinkDef {
  to: string
  label: string
  section: 'menu' | 'resources' | 'dev'
}

const links: NavLinkDef[] = [
  { to: '/dashboard', label: 'Dashboard', section: 'menu' },
  { to: '/rounds', label: 'Rounds', section: 'menu' },
  { to: '/stats', label: 'Strokes gained', section: 'menu' },
  { to: '/patterns', label: 'Shot patterns', section: 'menu' },
  { to: '/practice', label: 'Practice', section: 'menu' },
  // Planner hidden from nav until the redesign lands (on-map HUD + notes,
  // to match live-round). The /plan route still exists for dev/preview.
  // Re-enable this line when #385 is polished.
  // { to: '/plan', label: 'Planner', section: 'menu' },
  { to: '/learn', label: 'Learn', section: 'resources' },
  { to: '/settings/bag', label: 'My bag', section: 'resources' },
  { to: '/settings', label: 'Settings', section: 'resources' },
  // Only reachable when the /dev/courses route itself exists — router.tsx
  // gates that on import.meta.env.DEV, so this link (and the route) is
  // absent from production builds entirely.
  ...(import.meta.env.DEV
    ? [{ to: '/dev/courses', label: 'Course editor', section: 'dev' as const }]
    : []),
]

// Groups are told apart by a gap and a rule, not a caps label (DESIGN.md Kicker).
function SidebarSection({ label, links, first }: { label: string; links: NavLinkDef[]; first?: boolean }) {
  return (
    <div role="group" aria-label={label} style={{ paddingBlock: first ? '14px 10px' : '0 10px' }}>
      {!first && <div className="border-t border-white/10" style={{ margin: '0 22px 10px' }} />}
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          // /settings would otherwise highlight when /settings/bag is active
          // because NavLink uses prefix matching by default.
          end={l.to === '/dashboard' || l.to === '/settings'}
          className={({ isActive }) =>
            [
              'transition-colors block',
              isActive
                ? 'text-caddie-accent-ink'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80',
            ].join(' ')
          }
          style={({ isActive }) => ({
            fontSize: 14,
            fontWeight: isActive ? 500 : 400,
            padding: '8px 14px',
            margin: '1px 8px',
            borderRadius: 2,
            backgroundColor: isActive ? 'rgba(242,238,229,0.12)' : undefined,
          })}
        >
          {l.label}
        </NavLink>
      ))}
    </div>
  )
}

function deriveInitials(username: string | null | undefined): string {
  const base = (username ?? '').trim()
  if (!base) return 'OG'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export function Sidebar() {
  const { data: profile } = useProfile()
  const { data: handicapMeta } = useHandicapMeta()
  const initials = deriveInitials(profile?.username)

  return (
    <aside
      className="flex flex-col bg-caddie-ink text-caddie-bg"
      style={{ width: 220 }}
    >
      <div
        className="border-b border-white/10"
        style={{ padding: '20px 18px 16px' }}
      >
        <div
          className="font-serif text-caddie-bg"
          style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic' }}
        >
          oga
          {/* Upright period — the "o." brand mark. Cream (not forest) on the
              dark sidebar, matching the splash treatment where the forest
              period would vanish against #1C211C. */}
          <span style={{ fontStyle: 'normal' }}>.</span>
        </div>
        <div className="text-white/45" style={{ fontSize: 12, marginTop: 2 }}>
          Open Golf App
        </div>
      </div>

      <nav className="flex flex-1 flex-col">
        <SidebarSection first label="Menu" links={links.filter((l) => l.section === 'menu')} />
        <SidebarSection label="Resources" links={links.filter((l) => l.section === 'resources')} />
        {import.meta.env.DEV && <SidebarSection label="Dev" links={links.filter((l) => l.section === 'dev')} />}
      </nav>

      <div style={{ padding: '12px 14px 6px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <span className="text-white/40" style={{ fontSize: 12 }}>Support OGA</span>
          <a
            href="https://ko-fi.com/nartana"
            target="_blank"
            rel="noreferrer"
            className="text-white/45 transition-colors hover:text-caddie-accent-ink"
            style={{ fontSize: 12 }}
          >
            Ko-fi
          </a>
          <a
            href="https://github.com/sponsors/cner-smith"
            target="_blank"
            rel="noreferrer"
            className="text-white/45 transition-colors hover:text-caddie-accent-ink"
            style={{ fontSize: 12 }}
          >
            Sponsor
          </a>
        </div>
      </div>

      <div
        className="border-t border-white/10"
        style={{ padding: '14px 14px 18px' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center bg-caddie-accent text-caddie-accent-ink"
            style={{
              width: 30,
              height: 30,
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 2,
            }}
          >
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <div
              className="truncate text-caddie-bg"
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              {profile?.username ?? 'Sign in'}
            </div>
            <div
              className="tabular text-white/50 flex flex-wrap items-center"
              style={{ fontSize: 12, marginTop: 2, gap: '2px 6px' }}
            >
              <span className="whitespace-nowrap">
                {profile?.handicap_index !== null && profile?.handicap_index !== undefined
                  ? `Handicap ${profile.handicap_index}`
                  : 'No handicap yet'}
              </span>
              {profile?.handicap_index != null && handicapMeta && (
                <span
                  style={{
                    background:
                      handicapMeta.provenance === 'calculated'
                        ? 'rgba(31,61,44,0.65)'
                        : 'rgba(138,139,126,0.3)',
                    color:
                      handicapMeta.provenance === 'calculated'
                        ? '#F2EEE5'
                        : 'rgba(242,238,229,0.85)',
                    padding: '0 5px',
                    fontSize: 11,
                    borderRadius: 2,
                  }}
                  title={
                    handicapMeta.provenance === 'calculated'
                      ? `Calculated from ${handicapMeta.differentialsCount} rounds with rated tees`
                      : 'Self-reported — play 3+ rated rounds for a calculated WHS index'
                  }
                >
                  {HANDICAP_PROVENANCE_LABEL[handicapMeta.provenance]}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-3 text-white/45 transition-colors hover:text-white/80"
          style={{ fontSize: 12 }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
