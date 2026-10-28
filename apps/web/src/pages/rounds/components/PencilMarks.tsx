import { useMemo } from 'react'
import { marksFor, marksPath, pencilTick } from './pencil'

// Pencil graphite (mobile paper tokens P.graphite).
export const GRAPHITE = '#353430'

// Scorecard golf marks around a score (#611 §15), as on mobile's GolfMark:
// birdie circle, eagle two circles, bogey square, double-or-worse two squares;
// nothing at par. Seeded by hole number so each mark is its own. Centred on
// its parent, nudged up 3px to sit on the Kalam figure's visual centre.
const BOX = 62
const SCALE = 1.02
export function GolfMark({ toPar, seed }: { toPar: number; seed: number }) {
  const d = useMemo(() => marksPath(marksFor(toPar, seed)), [toPar, seed])
  if (!d) return null
  const v = BOX / SCALE
  return (
    <svg
      aria-hidden
      width={BOX}
      height={BOX}
      viewBox={`${-v / 2} ${-v / 2} ${v} ${v}`}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginLeft: -BOX / 2,
        marginTop: -BOX / 2 - 3,
        pointerEvents: 'none',
      }}
    >
      <path d={d} fill={GRAPHITE} opacity={0.9} />
    </svg>
  )
}

// Fairway / green hit, in the same pencil (drawn at 1.4x to match the marks).
const TICK = 24
const TICK_VIEW = TICK / 1.4
export function PencilTick({ seed }: { seed: number }) {
  const d = useMemo(() => marksPath(pencilTick(seed)), [seed])
  return (
    <svg
      aria-hidden
      width={TICK}
      height={TICK}
      viewBox={`${-TICK_VIEW / 2} ${-TICK_VIEW / 2} ${TICK_VIEW} ${TICK_VIEW}`}
    >
      <path d={d} fill={GRAPHITE} opacity={0.9} />
    </svg>
  )
}
