import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../../hooks/useProfile'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/rounds', label: 'Rounds' },
  { to: '/stats', label: 'Strokes Gained' },
  { to: '/patterns', label: 'Shot Patterns' },
  { to: '/practice', label: 'Practice' },
]

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
      className="flex flex-col bg-oga-black text-white"
      style={{ width: 220 }}
    >
      <div
        className="border-b border-white/[0.08]"
        style={{ padding: '18px 18px 14px' }}
      >
        <div className="font-medium text-white" style={{ fontSize: 18 }}>
          OGA
        </div>
        <div className="text-white/40" style={{ fontSize: 10 }}>
          Open Golf App
        </div>
      </div>

      <div
        className="uppercase text-white/30"
        style={{
          fontSize: 10,
          letterSpacing: '0.5px',
          padding: '14px 12px 6px',
        }}
      >
        Menu
      </div>

      <nav className="flex flex-1 flex-col">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              [
                'transition-colors',
                isActive
                  ? 'text-[#5DCAA5]'
                  : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80',
              ].join(' ')
            }
            style={({ isActive }) => ({
              fontSize: 13,
              padding: '8px 14px',
              margin: '1px 8px',
              borderRadius: 7,
              backgroundColor: isActive ? 'rgba(29,158,117,0.20)' : undefined,
            })}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div
        className="border-t border-white/[0.08]"
        style={{ padding: '14px 14px 16px' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full bg-oga-green text-white"
            style={{ width: 30, height: 30, fontSize: 12, fontWeight: 500 }}
          >
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <div
              className="truncate text-white"
              style={{ fontSize: 12, fontWeight: 500 }}
            >
              {profile?.username ?? 'Sign in'}
            </div>
            <div className="text-white/40 tabular" style={{ fontSize: 10 }}>
              {profile?.handicap_index !== null && profile?.handicap_index !== undefined
                ? `Hcp ${profile.handicap_index}`
                : 'No handicap set'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-3 text-white/40 transition-colors hover:text-white/70"
          style={{ fontSize: 10 }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
