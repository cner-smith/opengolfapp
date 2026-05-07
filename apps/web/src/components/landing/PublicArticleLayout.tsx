import { Outlet } from 'react-router-dom'

// Padding wrapper for public content pages (Learn) so they read the
// same way they did inside AppShell. Adds the ~120px top offset to
// clear PublicNav and a centered max-width main column.
export function PublicArticleLayout() {
  return (
    <main style={{ paddingTop: 120, paddingBottom: 80 }}>
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '0 28px',
        }}
      >
        <Outlet />
      </div>
    </main>
  )
}
