import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-caddie-bg text-caddie-ink">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ padding: '28px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}
