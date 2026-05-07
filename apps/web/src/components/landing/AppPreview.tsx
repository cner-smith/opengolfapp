import { lazy, Suspense } from 'react'

// Lazy-load DemoMap so mapbox-gl stays in its own chunk and out of the
// landing-page first-paint critical path. The phone frame paints
// immediately; the satellite tiles fill in once the chunk arrives.
const DemoMap = lazy(() =>
  import('./DemoMap').then((m) => ({ default: m.DemoMap })),
)

const DEMO_HOLE = {
  number: 7,
  par: 4,
  yards: 387,
  tee: { lat: 35.6234, lng: -97.5123 },
  pin: { lat: 35.6271, lng: -97.5058 },
}

const DEMO_SHOTS = [
  { shotNumber: 1, lat: 35.6234, lng: -97.5123 },
  { shotNumber: 2, lat: 35.6251, lng: -97.5089 },
  { shotNumber: 3, lat: 35.6263, lng: -97.5071 },
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
              color: '#F2EEE5',
              padding: '14px 16px 12px',
              borderBottom: '1px solid rgba(242, 238, 229, 0.1)',
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
                color: 'rgba(242, 238, 229, 0.55)',
                marginTop: 4,
              }}
            >
              Hole {DEMO_HOLE.number} · Par {DEMO_HOLE.par} · {DEMO_HOLE.yards} yd
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
              background: '#FBF8F1',
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
