import { lazy, Suspense } from 'react'

// Lazy-load DemoMap so mapbox-gl stays in its own chunk and out of the
// landing-page first-paint critical path. The phone frame paints
// immediately; the satellite tiles fill in once the chunk arrives.
const DemoMap = lazy(() =>
  import('./DemoMap').then((m) => ({ default: m.DemoMap })),
)

// Pebble Beach #7 — the iconic 107-yard par 3 to a green on the point,
// real coords from the courses DB. Hardcoded so the preview lands on the
// actual hole in Mapbox satellite tiles (ocean-wrapped green) instead of
// empty terrain — and it's instantly recognizable on the marketing page.
const DEMO_HOLE = {
  number: 7,
  par: 3,
  tee: { lat: 36.562223, lng: -121.940501 },
  pin: { lat: 36.561345, lng: -121.940382 },
}

// Shot starts walking down toward the green (markers = where each shot
// began): tee, a short pitch, then on the green near the pin.
const DEMO_SHOTS = [
  { shotNumber: 1, lat: 36.562223, lng: -121.940501 },
  { shotNumber: 2, lat: 36.561700, lng: -121.94046 },
  { shotNumber: 3, lat: 36.561432, lng: -121.940402 },
]

// Phone-shaped frame around a real Mapbox view of Pebble Beach #7. The
// data is hardcoded but the rendering goes through the same Mapbox
// satellite tiles + marker styling the live app uses, so what visitors
// see on the marketing page is what the app actually shows on course.
export function AppPreview() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: 320,
          aspectRatio: '9 / 19',
          borderRadius: 36,
          background: '#1C211C',
          border: '1px solid #9F9580',
          padding: 14,
          position: 'relative',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 110,
            height: 22,
            background: '#1C211C',
            borderRadius: '0 0 14px 14px',
            zIndex: 4,
          }}
        />
        {/* Live satellite map fills the screen, with the HUD overlaid — the
            current live-mode layout (apps/mobile HoleMapOverlays): on-map
            pills, not header/footer bars. */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 24,
            overflow: 'hidden',
            position: 'relative',
            background: '#28482e',
          }}
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            <Suspense fallback={<MapFallback />}>
              <DemoMap tee={DEMO_HOLE.tee} pin={DEMO_HOLE.pin} shots={DEMO_SHOTS} />
            </Suspense>
          </div>

          {/* To Hole — top-left HUD pill */}
          <HudPill align="flex-start" style={{ top: 12, left: 12 }} kicker="To Hole" value="43" />
          {/* Expected strokes to hole out — top-right */}
          <HudPill align="flex-end" style={{ top: 12, right: 12 }} kicker="Exp · to hole" value="2.6" />

          {/* Instructional hint line (matches the live TopHint copy) */}
          <div
            style={{
              position: 'absolute',
              top: 62,
              left: 12,
              right: 12,
              background: 'rgba(28,33,28,0.78)',
              borderRadius: 2,
              padding: '5px 9px',
            }}
          >
            <span
              className="font-mono uppercase"
              style={{ color: '#F2EEE5', fontSize: 9, fontWeight: 600, letterSpacing: '0.14em' }}
            >
              Drag to refine · tap to mark ball
            </span>
          </div>

          {/* Left icon toolbar — slope (soon) · shot pattern · place pin */}
          <div
            style={{
              position: 'absolute',
              left: 10,
              bottom: 46,
              background: 'rgba(28,33,28,0.82)',
              borderRadius: 18,
              padding: '5px 3px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              alignItems: 'center',
            }}
          >
            <ToolIcon kind="terrain" disabled />
            <ToolIcon kind="grain" active />
            <ToolIcon kind="flag" />
          </div>

          {/* Course label — marketing identifier, kept subtle bottom-center */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(28,33,28,0.82)',
              borderRadius: 4,
              padding: '5px 11px',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              className="font-mono uppercase"
              style={{ color: 'rgba(242,238,229,0.85)', fontSize: 9, letterSpacing: '0.16em' }}
            >
              Hole {DEMO_HOLE.number} · Par {DEMO_HOLE.par} · 107 yd
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MapFallback() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(circle at 70% 65%, #3e6a44 0%, #2c5034 45%, #244429 100%)',
      }}
    />
  )
}

// Dark translucent HUD pill — matches apps/mobile HoleMapOverlays (To Hole /
// Exp readouts). Kicker label over a large upright-serif tabular value.
function HudPill({
  kicker,
  value,
  align,
  style,
}: {
  kicker: string
  value: string
  align: 'flex-start' | 'flex-end'
  style: React.CSSProperties
}) {
  return (
    <div
      style={{
        position: 'absolute',
        background: 'rgba(28,33,28,0.82)',
        borderRadius: 4,
        padding: '6px 11px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: align,
        minWidth: 72,
        ...style,
      }}
    >
      <span
        className="font-mono uppercase"
        style={{
          color: 'rgba(242,238,229,0.65)',
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: '0.13em',
        }}
      >
        {kicker}
      </span>
      <span
        className="font-serif"
        style={{
          color: '#F2EEE5',
          fontSize: 18,
          fontWeight: 500,
          fontVariant: 'tabular-nums',
          marginTop: 1,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// Compact replica of the live left-toolbar buttons: cream icon on the dark
// pill, cream-filled when active (the shot-pattern toggle is on here).
function ToolIcon({
  kind,
  active,
  disabled,
}: {
  kind: 'terrain' | 'grain' | 'flag'
  active?: boolean
  disabled?: boolean
}) {
  const stroke = active ? '#1C211C' : '#F2EEE5'
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? '#FBF8F1' : 'transparent',
        opacity: disabled ? 0.34 : 1,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {kind === 'terrain' && <path d="M3 20l6-10 4 6 3-4 5 8z" />}
        {kind === 'grain' && (
          <>
            <circle cx="7" cy="8" r="1.4" fill={stroke} stroke="none" />
            <circle cx="13" cy="11" r="1.4" fill={stroke} stroke="none" />
            <circle cx="9" cy="15" r="1.4" fill={stroke} stroke="none" />
            <circle cx="16" cy="16" r="1.4" fill={stroke} stroke="none" />
          </>
        )}
        {kind === 'flag' && <path d="M5 21V4h11l-2 4 2 4H5" />}
      </svg>
    </div>
  )
}
