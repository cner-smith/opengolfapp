import { mapboxgl } from '../../../lib/mapbox'

export const MARKER_COLORS = {
  tee: '#1C211C',
  approach: '#A66A1F',
  green: '#1F3D2C',
  putt: '#1F3D2C',
  ball: '#1F3D2C',
  pin: '#A33A2A',
  // caddie-neg — the shot that went OB (#839). Same hex as `pin`, kept as
  // its own key for readability at call sites that mean "OB", not "pin".
  ob: '#A33A2A',
} as const

// ---------------------------------------------------------------------------
// DOM marker factories — keep them lightweight, no React per marker.
//
// Mapbox writes inline `transform: translate3d(...)` on the marker's
// outer element to position it, so we can't put our own transform there
// (it would be wiped on the next pan). Each factory returns an outer
// (positioned by Mapbox) plus an inner `content` we own — that's where
// hover scale and drag glow are applied. See `attachDragFx`.
// ---------------------------------------------------------------------------

export interface MarkerParts {
  outer: HTMLElement
  content: HTMLElement
}

export function makeNumberedMarker(
  n: number,
  fill: string,
  text: string,
): MarkerParts {
  const outer = document.createElement('div')
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  const content = document.createElement('div')
  content.style.width = '24px'
  content.style.height = '24px'
  content.style.borderRadius = '999px'
  content.style.background = fill
  content.style.color = text
  content.style.fontFamily = 'Epilogue, sans-serif'
  content.style.fontWeight = '600'
  content.style.fontSize = '12px'
  content.style.display = 'flex'
  content.style.alignItems = 'center'
  content.style.justifyContent = 'center'
  content.style.border = '2px solid #FBF8F1'
  content.style.transition =
    'transform 120ms ease, box-shadow 120ms ease'
  content.textContent = String(n)
  outer.appendChild(content)
  return { outer, content }
}

export function makeAimMarker(): HTMLElement {
  const outer = document.createElement('div')
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  const dot = document.createElement('div')
  dot.style.cssText = [
    'width:14px',
    'height:14px',
    'border-radius:999px',
    'background:#A66A1F',
    'border:2px solid #FBF8F1',
    'pointer-events:none',
  ].join(';')
  outer.appendChild(dot)
  outer.title = 'Aim point'
  return outer
}

// Understated tee-box dot. Two of these flank the tee shot (perpendicular to
// the line of play), mirroring the mobile redesign — deliberately quieter than
// the old draggable 'TEE' badge. Non-interactive.
export function makeTeeDotMarker(): HTMLElement {
  const outer = document.createElement('div')
  const dot = document.createElement('div')
  dot.style.cssText = [
    'width:9px',
    'height:9px',
    'border-radius:999px',
    'background:#FBF8F1',
    'border:1.5px solid rgba(28,33,28,0.55)',
    'box-shadow:0 0 0 1px rgba(255,255,255,0.25)',
    'pointer-events:none',
  ].join(';')
  outer.appendChild(dot)
  outer.title = 'Tee box'
  return outer
}

export function makeDistancePill(
  label: string,
  opts: { sublabel?: string; tone?: 'pos' | 'neg' } = {},
): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'background:rgba(28,33,28,0.85)',
    'color:#F2EEE5',
    'font-family:Inconsolata, monospace',
    'font-size:11px',
    'font-weight:500',
    'letter-spacing:0.04em',
    'padding:3px 8px',
    'border-radius:999px',
    'pointer-events:none',
    'white-space:nowrap',
    'text-align:center',
    'line-height:1.25',
  ].join(';')
  const main = document.createElement('div')
  main.textContent = label
  el.appendChild(main)
  // Optional second line — the live best-case SG on the carry pill
  // ("+0.3 · FWY"), tinted positive/negative.
  if (opts.sublabel) {
    const sub = document.createElement('div')
    sub.textContent = opts.sublabel
    sub.style.cssText = [
      'font-size:9px',
      'margin-top:1px',
      `color:${opts.tone === 'neg' ? '#E0796B' : '#9FD8A8'}`,
    ].join(';')
    el.appendChild(sub)
  }
  return el
}

export function makeIconMarker(
  label: string,
  bg: string,
  fg: string,
): MarkerParts {
  const outer = document.createElement('div')
  const content = document.createElement('div')
  content.style.padding = '3px 6px'
  content.style.background = bg
  content.style.color = fg
  content.style.fontFamily = 'Inconsolata, monospace'
  content.style.fontSize = '9px'
  content.style.letterSpacing = '0.14em'
  content.style.fontWeight = '500'
  content.style.border = `1px solid ${fg}`
  content.style.borderRadius = '2px'
  content.style.transition =
    'transform 120ms ease, box-shadow 120ms ease'
  content.textContent = label
  outer.appendChild(content)
  return { outer, content }
}

export interface FlagParts extends MarkerParts {
  /** The cloth — tinted while dragging. */
  flag: SVGPathElement
}

// G4 flag (#611 LOCKED-SPEC §9, #904) — the same glyph as mobile's
// FlagMarker, drawn top-down (cup squash k 0.8; the web map doesn't tilt).
// viewBox 38×48 at 38 px tall; the pin point (cup centre) is (9, 42), so
// the marker needs FLAG_OFFSET with anchor 'top-left'. `strong` = this
// round's pin is set; otherwise the course default is drawn hollow.
export const FLAG_CLOTH = '#A33A2A'
const FLAG_SCALE = 38 / 48
export const FLAG_OFFSET: [number, number] = [-9 * FLAG_SCALE, -42 * FLAG_SCALE]

export function makeFlagMarker({ hole, strong }: { hole: number; strong: boolean }): FlagParts {
  const outer = document.createElement('div')
  const content = document.createElement('div')
  content.style.cssText = 'width:30.08px;height:38px;transition:transform 120ms ease'
  const wide = hole >= 10
  const end = wide ? 34.4 : 29.9
  const [c1, c2] = wide ? [15.52, 20.36] : [14.53, 18.47]
  const cloth = `M10.2 1.4 C${c1} 0.2 ${c2} 2.8 ${end} 1.4 L${end} 17.4 C${c2} 18.8 ${c1} 16.2 10.2 17.6 Z`
  const ink = '#1C211C'
  const cream = '#FBF8F1'
  const cup = strong
    ? `<ellipse cx="9" cy="42" rx="7.2" ry="5.76" fill="${ink}"/>
       <path d="M3.38 41.71 A5.76 4.15 0 0 1 14.62 41.71 A5.76 2.59 0 0 0 3.38 41.71 Z" fill="${cream}" opacity=".85"/>
       <path d="M1.8 42 A7.2 5.76 0 0 1 16.2 42" fill="none" stroke="${cream}" stroke-width="1.6"/>`
    : `<ellipse cx="9" cy="42" rx="7.2" ry="5.76" fill="${ink}" opacity=".28"/>
       <ellipse cx="9" cy="42" rx="7.2" ry="5.76" fill="none" stroke="${ink}" stroke-width="2.8" opacity=".5"/>
       <ellipse cx="9" cy="42" rx="7.2" ry="5.76" fill="none" stroke="${cream}" stroke-width="1.6" stroke-dasharray="3 2.2"/>`
  const pole = strong
    ? `<rect x="7.8" y="1.4" width="2.4" height="34.84" fill="${cream}"/>
       <rect x="7.8" y="36.24" width="2.4" height="5.76" fill="#6E7266"/>
       <path d="M16.2 42 A7.2 5.76 0 0 1 1.8 42" fill="none" stroke="${cream}" stroke-width="1.6"/>`
    : `<rect x="7.8" y="1.4" width="2.4" height="40.6" fill="${cream}"/>`
  content.innerHTML = `<svg viewBox="0 0 38 48" width="30.08" height="38" style="overflow:visible;display:block">
    <ellipse cx="10.2" cy="44.02" rx="9.8" ry="7.84" fill="${ink}" opacity="${strong ? 0.22 : 0.14}"/>
    ${cup}
    <rect x="7" y="0.6" width="4" height="41.4" fill="${ink}"/>
    ${pole}
    <path data-cloth d="${cloth}" fill="${strong ? FLAG_CLOTH : '#F2EEE5'}" stroke="${strong ? ink : FLAG_CLOTH}" stroke-width="${strong ? 0.8 : 1.5}" style="transition:fill 120ms ease"/>
    <text x="${(10.2 + end) / 2}" y="14.6" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="500" font-size="13.5" letter-spacing="${wide ? -0.3 : 0}" fill="${strong ? cream : FLAG_CLOTH}">${hole}</text>
  </svg>`
  outer.appendChild(content)
  const flag = content.querySelector('path[data-cloth]') as SVGPathElement
  return { outer, content, flag }
}

// OB badge ring (#839, mirrors mobile's BreadcrumbLayers `prevShotsObRing`).
// A stroke-and-distance OB's re-hit starts from the exact same coordinates
// as the OB shot itself (no renumbering — the re-hit is just the next
// struck-shot number), so the re-hit's numbered marker lands directly on
// top of the OB shot's own marker. A same-radius recolor alone would just
// have whichever marker got added to the map last silently win the DOM
// stacking order and read as a rendering glitch. This wider transparent-
// fill ring is added to the map BEFORE any numbered-marker discs for the
// hole (Mapbox markers paint in DOM-insertion order, so earlier-added
// elements render underneath), sized past a disc's radius, so its red edge
// always peeks out around whichever disc ends up on top.
export function makeObRingMarker(): HTMLElement {
  const ring = document.createElement('div')
  ring.style.cssText = [
    'width:34px',
    'height:34px',
    'border-radius:999px',
    'background:transparent',
    `border:3px solid ${MARKER_COLORS.ob}`,
    'pointer-events:none',
  ].join(';')
  return ring
}

export function attachDragFx(opts: {
  outer: HTMLElement
  content: HTMLElement
  marker: mapboxgl.Marker
  tooltip: string
  onDragColor?: (active: boolean) => void
}) {
  const { outer, content, marker, tooltip, onDragColor } = opts
  outer.title = tooltip
  outer.style.cursor = 'grab'
  let dragging = false
  outer.addEventListener('mouseenter', () => {
    if (!dragging) content.style.transform = 'scale(1.2)'
  })
  outer.addEventListener('mouseleave', () => {
    if (!dragging) content.style.transform = ''
  })
  marker.on('dragstart', () => {
    dragging = true
    outer.style.cursor = 'grabbing'
    content.style.transform = 'scale(1.2)'
    content.style.boxShadow = '0 0 0 4px rgba(166,106,31,0.55)'
    onDragColor?.(true)
  })
  marker.on('dragend', () => {
    dragging = false
    outer.style.cursor = 'grab'
    content.style.transform = ''
    content.style.boxShadow = ''
    onDragColor?.(false)
  })
}
