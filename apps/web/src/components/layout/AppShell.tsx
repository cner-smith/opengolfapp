import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-oga-bg-page text-oga-text-primary">
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto"
        style={{ padding: '20px 22px' }}
      >
        {children}
      </main>
    </div>
  )
}
