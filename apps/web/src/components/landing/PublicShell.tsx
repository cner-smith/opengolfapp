import { Suspense, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { PublicNav } from './PublicNav'
import { Footer } from '../../pages/landing/LandingSections'
import './landing.css'

// Shell for public, unauthenticated routes. PublicNav is fixed-top so
// children are responsible for their own top padding (Landing wants
// full-bleed; content pages add ~120px to clear the nav). Every page ends
// on the landing's footer, so the reader always has somewhere to go.
export function PublicShell({ children }: { children?: ReactNode }) {
  return (
    <div
      className="bg-caddie-bg text-caddie-ink"
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <PublicNav />
      <div style={{ flex: 1 }}>
        <Suspense fallback={<RouteFallback />}>
          {children ?? <Outlet />}
        </Suspense>
      </div>
      <Footer />
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
