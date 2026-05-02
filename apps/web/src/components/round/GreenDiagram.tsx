import { useEffect, useRef, useState } from 'react'
import type { BreakDirection } from '@oga/core'
import { useUnits } from '../../hooks/useUnits'

export type { BreakDirection }

export interface GreenDiagramProps {
  distanceFt: number
  aimOffsetInches: number
  breakDirection?: BreakDirection
  onAimChange: (offsetInches: number) => void
}

// Editorial perspective view of the green from behind the ball.
// Pure SVG, no gradients/shadows. Aim handle is draggable on either
// pointer or touch. See DESIGN.md "Map screens" + paper aesthetic
// rules; this is on-paper, not satellite.
export function GreenDiagram({
  distanceFt,
  aimOffsetInches,
  breakDirection = 'straight',
  onAimChange,
}: GreenDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const { toDisplayFt } = useUnits()

  // Pin pos shifts up slightly for uphill, down for downhill.
  const pinY = breakDirection === 'uphill' ? 56 : breakDirection === 'downhill' ? 80 : 68
  const ballX = 150
  const ballY = 200

  // Trapezoid corners. Slope direction skews the foreground edge so the
  // ground plane reads as tilted, very subtly.
  const tilt =
    breakDirection === 'left_to_right' ? -10 : breakDirection === 'right_to_left' ? 10 : 0
  const leftFrontY = 220 + tilt
  const rightFrontY = 220 - tilt
  const leftBackY = 100 + (breakDirection === 'uphill' ? -10 : 0)
  const rightBackY = 100 + (breakDirection === 'uphill' ? -10 : 0)
  const trapezoid = `M30 ${leftFrontY} L270 ${rightFrontY} L240 ${rightBackY} L60 ${leftBackY} Z`

  // Aim handle x is driven by aimOffsetInches. Show ±20 in range covering
  // ~70 px each side. Clamp visually so the handle stays on the green.
  const PX_PER_INCH = 3
  const handleX = clamp(150 + aimOffsetInches * PX_PER_INCH, 50, 250)
  const handleY = 150
  // Curve: quadratic bezier from ball through handle area to pin x.
  const curveControl = `${handleX * 0.6 + 150 * 0.4},${handleY}`

  function handlePointerMove(clientX: number) {
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = clientX
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const inv = ctm.inverse()
    const local = pt.matrixTransform(inv)
    const offsetInches = (local.x - 150) / PX_PER_INCH
    onAimChange(Math.round(clamp(offsetInches, -50, 50)))
  }

  useEffect(() => {
    if (!dragging) return
    function onMove(e: PointerEvent) {
      handlePointerMove(e.clientX)
    }
    function onUp() {
      setDragging(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  const aimLabel = formatAim(aimOffsetInches)

  return (
    <div
      className="bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: 14,
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 8 }}
      >
        <div>
          <div className="kicker">To pin</div>
          <div
            className="font-serif tabular text-caddie-ink"
            style={{
              fontSize: 28,
              fontStyle: 'italic',
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            {toDisplayFt(distanceFt)}
          </div>
        </div>
        <div className="kicker text-caddie-ink-mute">
          {breakDirection === 'straight'
            ? 'Straight'
            : breakDirection.replace(/_/g, ' ')}
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 300 240"
        width="100%"
        style={{ display: 'block' }}
        onPointerDown={(e) => {
          setDragging(true)
          handlePointerMove(e.clientX)
        }}
      >
        {/* Green plane */}
        <path d={trapezoid} fill="#8db87a" stroke="#6a9960" strokeWidth={1.5} />

        {/* Subtle fringe inside */}
        <path
          d={`M50 ${leftFrontY - 6} L250 ${rightFrontY - 6} L225 ${rightBackY + 6} L75 ${leftBackY + 6} Z`}
          fill="none"
          stroke="rgba(106,153,96,0.4)"
          strokeWidth={0.75}
          strokeDasharray="4 3"
        />

        {/* Pin: pole + flag + cup */}
        <line x1={150} y1={pinY} x2={150} y2={pinY + 60} stroke="#1C211C" strokeWidth={1.5} />
        <path
          d={`M150 ${pinY} L168 ${pinY + 8} L150 ${pinY + 16} Z`}
          fill="#A33A2A"
        />
        <ellipse cx={150} cy={pinY + 60} rx={6} ry={2} fill="#1C211C" opacity={0.75} />

        {/* Aim line */}
        <path
          d={`M${ballX} ${ballY} Q ${curveControl} ${150} ${pinY + 60}`}
          fill="none"
          stroke="#A66A1F"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.85}
        />

        {/* Ball + shadow */}
        <ellipse cx={ballX} cy={ballY + 6} rx={8} ry={2.5} fill="rgba(28,33,28,0.35)" />
        <circle
          cx={ballX}
          cy={ballY}
          r={6}
          fill="#FBF8F1"
          stroke="#1C211C"
          strokeWidth={1}
        />

        {/* Aim handle */}
        <circle
          cx={handleX}
          cy={handleY}
          r={11}
          fill="#A66A1F"
          stroke="#FBF8F1"
          strokeWidth={2}
          style={{ cursor: 'ew-resize' }}
        />
      </svg>
      <div
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 17,
          fontWeight: 500,
          textAlign: 'center',
          marginTop: 6,
        }}
      >
        {aimLabel}
      </div>
    </div>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function formatAim(offsetInches: number): string {
  const rounded = Math.round(offsetInches)
  if (Math.abs(rounded) <= 2) return 'Straight'
  if (rounded < 0) return `${Math.abs(rounded)} in left`
  return `${rounded} in right`
}
