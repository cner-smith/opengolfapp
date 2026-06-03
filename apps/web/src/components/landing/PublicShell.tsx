import { Suspense, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { PublicNav } from './PublicNav'

// Shell for public, unauthenticated routes. PublicNav is fixed-top so
// children are responsible for their own top padding (Landing wants
// full-bleed; content pages add ~120px to clear the nav).
export function PublicShell({ children }: { children?: ReactNode }) {
  return (
    <div
      className="bg-caddie-bg text-caddie-ink"
      style={{ minHeight: '100vh' }}
    >
      <PublicNav />
      <Suspense fallback={<RouteFallback />}>
        {children ?? <Outlet />}
      </Suspense>
    </div>
  )
}

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Epilogue, sans-serif',
        fontSize: 14,
        color: '#5C6356',
      }}
    >
      Loading…
    </div>
  )
}
