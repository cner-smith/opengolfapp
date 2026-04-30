import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-caddie-bg text-caddie-ink">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ padding: '28px 32px' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
          }}
        >
          <div style={{ flex: 1 }}>{children}</div>
          <footer
            className="font-mono uppercase text-caddie-ink-mute"
            style={{
              borderTop: '1px solid #D9D2BF',
              marginTop: 40,
              paddingTop: 18,
              fontSize: 10,
              letterSpacing: '0.14em',
            }}
          >
            Course data from{' '}
            <a
              href="https://opengolfapi.org"
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'underline' }}
            >
              OpenGolfAPI
            </a>{' '}
            · ODbL licensed
          </footer>
        </div>
      </main>
    </div>
  )
}
