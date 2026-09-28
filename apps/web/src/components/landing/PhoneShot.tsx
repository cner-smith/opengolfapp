import type { ReactNode } from 'react'

// A real app screenshot in a phone frame, with an optional paper tag and
// pencil arrow — the store-listing style (store-assets v1.6, direction A).
// Everything is laid out in one 300 × 642 frame space (10-unit bezel around a
// 280 × 622 screen, the 1080 × 2400 capture's aspect), so the tag and arrow
// scale with the phone at any width. To place a point from a capture pixel:
// x = 10 + px · 280/1080, y = 10 + py · 622/2400.
const W = 300
const H = 642

export function PhoneShot({
  src,
  alt,
  tag,
  arrow,
  priority = false,
}: {
  src: string
  alt: string
  /** Paper tag: left/top/width in frame units; text is handwritten (Kalam). */
  tag?: { text: ReactNode; left: number; top: number; width?: number }
  /** Pencil arrow from [x1, y1] to [x2, y2] (the head), in frame units. */
  arrow?: [number, number, number, number]
  /** Above the fold (the hero): load eagerly at high priority — it's the LCP. */
  priority?: boolean
}) {
  return (
    <div className="phone-shot" style={{ aspectRatio: `${W} / ${H}` }}>
      <div className="phone-shot-device">
        <img
          src={src}
          alt={alt}
          width={540}
          height={1200}
          loading={priority ? 'eager' : 'lazy'}
          // Lowercase: React 18 warns on the camelCase prop (React 19 knows it).
          {...{ fetchpriority: priority ? 'high' : 'auto' }}
          decoding="async"
        />
      </div>
      {arrow && <PencilArrow points={arrow} />}
      {tag && (
        <div
          className="phone-shot-tag"
          aria-hidden
          style={{
            left: `${(tag.left / W) * 100}%`,
            top: `${(tag.top / H) * 100}%`,
            width: `${((tag.width ?? 120) / W) * 100}%`,
          }}
        >
          {tag.text}
        </div>
      )}
    </div>
  )
}

function PencilArrow({ points: [x1, y1, x2, y2] }: { points: [number, number, number, number] }) {
  // Gentle curve bowed to one side; head drawn at the target.
  const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18
  const my = (y1 + y2) / 2 + (x2 - x1) * 0.18
  const a = Math.atan2(y2 - my, x2 - mx)
  const hl = 7
  const h1 = [x2 - hl * Math.cos(a - 0.5), y2 - hl * Math.sin(a - 0.5)]
  const h2 = [x2 - hl * Math.cos(a + 0.5), y2 - hl * Math.sin(a + 0.5)]
  return (
    <svg className="phone-shot-arrow" viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <path
        d={`M${x1} ${y1} Q ${mx} ${my}, ${x2} ${y2} M${h1[0]} ${h1[1]} L${x2} ${y2} L${h2[0]} ${h2[1]}`}
        fill="none"
        stroke="#1C211C"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
