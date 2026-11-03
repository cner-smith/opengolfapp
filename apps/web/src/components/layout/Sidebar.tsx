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
  { to: '/dashboard', label: 'Home', section: 'menu' },
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
  { to: '/settings', label: 'Profile', section: 'resources' },
  // Only reachable when the /dev/courses route itself exists — router.tsx
  // gates that on import.meta.env.DEV, so this link (and the route) is
  // absent from production builds entirely.
  ...(import.meta.env.DEV
    ? [{ to: '/dev/courses', label: 'Course editor', section: 'dev' as const }]
    : []),
]

// Groups are told apart by a gap and a rule, not a caps label (DESIGN.md Kicker).
// Hover is text only; active carries the band plus a cream rule on its left
// edge, so a hovered row never reads as a second active one (SHL-12).
function SidebarSection({
  label,
  links,
  first,
  roomy,
}: {
  label: string
  links: NavLinkDef[]
  first?: boolean
  roomy?: boolean
}) {
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
          className="shell-nav-link flex items-center"
          style={{
            fontSize: roomy ? 15 : 14,
            minHeight: roomy ? 44 : 36,
            padding: '0 14px',
            margin: '1px 8px',
            borderRadius: 2,
          }}
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

// `onClose` = rendered inside the phone drawer: full height, roomier rows and
// a close key in the masthead.
export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { data: profile } = useProfile()
  const { data: handicapMeta } = useHandicapMeta()
  const initials = deriveInitials(profile?.username)
  const inDrawer = !!onClose

  return (
    <aside
      className="flex h-full flex-col bg-caddie-ink text-caddie-bg"
      style={{
        width: inDrawer ? 'min(296px, 84vw)' : 220,
        paddingTop: inDrawer ? 'env(safe-area-inset-top, 0px)' : undefined,
        paddingBottom: inDrawer ? 'env(safe-area-inset-bottom, 0px)' : undefined,
      }}
    >
      <div
        className="flex items-start justify-between border-b border-white/10"
        style={{ padding: inDrawer ? '14px 10px 14px 18px' : '20px 18px 16px' }}
      >
        <div style={{ paddingTop: inDrawer ? 6 : 0 }}>
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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex items-center justify-center text-caddie-bg transition-colors hover:bg-white/10"
            style={{ width: 44, height: 44, borderRadius: 3, border: '1px solid rgba(242,238,229,0.22)' }}
          >
            <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto">
        <SidebarSection first roomy={inDrawer} label="Menu" links={links.filter((l) => l.section === 'menu')} />
        <SidebarSection roomy={inDrawer} label="Resources" links={links.filter((l) => l.section === 'resources')} />
        {import.meta.env.DEV && (
          <SidebarSection roomy={inDrawer} label="Dev" links={links.filter((l) => l.section === 'dev')} />
        )}
      </nav>

      <div className="text-white/45" style={{ padding: '12px 22px 8px', fontSize: 12 }}>
        Support OGA:{' '}
        <a
          href="https://ko-fi.com/nartana"
          target="_blank"
          rel="noreferrer"
          className="text-white/60 underline-offset-2 transition-colors hover:text-caddie-bg hover:underline"
        >
          Ko-fi
        </a>
        {' · '}
        <a
          href="https://github.com/sponsors/cner-smith"
          target="_blank"
          rel="noreferrer"
          className="text-white/60 underline-offset-2 transition-colors hover:text-caddie-bg hover:underline"
        >
          Sponsor
        </a>
      </div>

      <div className="border-t border-white/10" style={{ padding: '12px 14px 16px' }}>
        <NavLink
          to="/settings"
          className="group flex items-center gap-3"
          style={{ padding: 6, margin: -6, borderRadius: 3 }}
        >
          <div
            className="flex items-center justify-center font-serif text-caddie-ink"
            style={{
              width: 34,
              height: 34,
              fontSize: 15,
              fontWeight: 500,
              fontStyle: 'italic',
              borderRadius: 3,
              background: '#F2EEE5',
              boxShadow: '0 2px 0 rgba(242,238,229,0.35)',
            }}
          >
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <div
              className="truncate text-caddie-bg transition-colors group-hover:text-white"
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              {profile?.username ?? 'Sign in'}
            </div>
            <div className="tabular text-white/50" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.35 }}>
              {profile?.handicap_index != null ? (
                <>
                  Handicap{' '}
                  <span className="font-serif text-white/80" style={{ fontStyle: 'italic', fontSize: 13 }}>
                    {profile.handicap_index}
                  </span>
                  {handicapMeta && (
                    <span className="block text-white/40">{HANDICAP_PROVENANCE_LABEL[handicapMeta.provenance]}</span>
                  )}
                </>
              ) : (
                'No handicap yet'
              )}
            </div>
          </div>
        </NavLink>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="text-white/45 transition-colors hover:text-white/80"
          style={{ fontSize: 12, marginTop: 12, minHeight: 28 }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
