import { Link } from 'react-router-dom'

// The "oga." mark on paper: italic Fraunces with an upright forest period,
// linking home. The dark app shell keeps its own cream-period version.
export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <Link
      to="/"
      aria-label="OGA home"
      className="font-serif text-caddie-ink"
      style={{ fontSize: size, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.05, textDecoration: 'none' }}
    >
      oga<span style={{ fontStyle: 'normal', color: '#1F3D2C' }}>.</span>
    </Link>
  )
}
