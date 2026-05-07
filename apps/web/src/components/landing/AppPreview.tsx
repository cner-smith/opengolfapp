import { lazy, Suspense } from 'react'

// Lazy-load DemoMap so mapbox-gl stays in its own chunk and out of the
// landing-page first-paint critical path. The phone frame paints
// immediately; the satellite tiles fill in once the chunk arrives.
const DemoMap = lazy(() =>
  import('./DemoMap').then((m) => ({ default: m.DemoMap })),
)

// Lake Hefner South — hole 1, real coords from the courses DB.
// Hardcoded so the preview lands on actual fairway in Mapbox satellite
// tiles instead of empty terrain.
const DEMO_HOLE = {
  number: 1,
  par: 4,
  tee: { lat: 35.552530168, lng: -97.602615572 },
  pin: { lat: 35.5504026026316, lng: -97.6044770631579 },
}

const DEMO_SHOTS = [
  { shotNumber: 1, lat: 35.552530168, lng: -97.602615572 },
  { shotNumber: 2, lat: 35.5518, lng: -97.6034 },
  { shotNumber: 3, lat: 35.5508, lng: -97.6041 },
]

// Phone-shaped frame around a real Mapbox view of a fake hole 7. The
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
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 24,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: '#28482e',
          }}
        >
          <div
            style={{
              background: '#1C211C',
              color: '#FBF8F1',
              padding: '14px 16px 12px',
              borderBottom: '1px solid rgba(251, 248, 241, 0.1)',
            }}
          >
            <div
              className="font-serif"
              style={{
                fontSize: 15,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              Lake Hefner South
            </div>
            <div
              className="font-mono uppercase"
              style={{
                fontSize: 9,
                letterSpacing: '0.18em',
                color: 'rgba(251, 248, 241, 0.55)',
                marginTop: 4,
              }}
            >
              Hole {DEMO_HOLE.number} · Par {DEMO_HOLE.par}
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <Suspense fallback={<MapFallback />}>
              <DemoMap
                tee={DEMO_HOLE.tee}
                pin={DEMO_HOLE.pin}
                shots={DEMO_SHOTS}
              />
            </Suspense>
          </div>
          <div
            style={{
              background: '#F2EEE5',
              color: '#1C211C',
              padding: '12px 16px',
              borderTop: '1px solid #D9D2BF',
            }}
          >
            <div
              className="font-mono uppercase"
              style={{
                fontSize: 9,
                letterSpacing: '0.18em',
                color: '#8A8B7E',
              }}
            >
              3 shots placed
            </div>
            <div
              className="font-serif"
              style={{
                fontSize: 14,
                fontStyle: 'italic',
                marginTop: 4,
              }}
            >
              42 yd to pin
            </div>
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
