import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../../hooks/useProfile'

interface NavLinkDef {
  to: string
  label: string
  section: 'menu' | 'resources'
}

const links: NavLinkDef[] = [
  { to: '/', label: 'Dashboard', section: 'menu' },
  { to: '/rounds', label: 'Rounds', section: 'menu' },
  { to: '/stats', label: 'Strokes Gained', section: 'menu' },
  { to: '/patterns', label: 'Shot Patterns', section: 'menu' },
  { to: '/practice', label: 'Practice', section: 'menu' },
  { to: '/learn', label: 'Learn', section: 'resources' },
]

function SidebarSection({
  label,
  links,
}: {
  label: string
  links: NavLinkDef[]
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        className="font-mono uppercase text-white/30"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          padding: '18px 14px 8px',
        }}
      >
        {label}
      </div>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/'}
          className={({ isActive }) =>
            [
              'transition-colors block',
              isActive
                ? 'text-caddie-accent-ink'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80',
            ].join(' ')
          }
          style={({ isActive }) => ({
            fontSize: 13,
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
          style={{ fontSize: 18, fontWeight: 500 }}
        >
          OGA
        </div>
        <div
          className="font-mono uppercase text-white/45"
          style={{ fontSize: 10, letterSpacing: '0.14em', marginTop: 4 }}
        >
          Open Golf App
        </div>
      </div>

      <nav className="flex flex-1 flex-col">
        <SidebarSection
          label="Menu"
          links={links.filter((l) => l.section === 'menu')}
        />
        <SidebarSection
          label="Resources"
          links={links.filter((l) => l.section === 'resources')}
        />
      </nav>

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
              className="font-mono uppercase tabular text-white/45"
              style={{ fontSize: 10, letterSpacing: '0.14em', marginTop: 2 }}
            >
              {profile?.handicap_index !== null && profile?.handicap_index !== undefined
                ? `HCP ${profile.handicap_index}`
                : 'NO HCP'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-3 font-mono uppercase text-white/40 transition-colors hover:text-white/70"
          style={{ fontSize: 10, letterSpacing: '0.14em' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
