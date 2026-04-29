import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/rounds', label: 'Rounds' },
  { to: '/stats', label: 'Strokes Gained' },
  { to: '/patterns', label: 'Shot Patterns' },
  { to: '/practice', label: 'Practice' },
]

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-fairway-100 bg-white p-4">
      <div className="mb-6 text-xl font-bold text-fairway-700">OGA</div>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              `rounded px-3 py-2 text-sm ${
                isActive
                  ? 'bg-fairway-100 font-medium text-fairway-900'
                  : 'text-gray-700 hover:bg-fairway-50'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-4 rounded px-3 py-2 text-left text-sm text-gray-600 hover:bg-fairway-50"
      >
        Sign out
      </button>
    </aside>
  )
}
