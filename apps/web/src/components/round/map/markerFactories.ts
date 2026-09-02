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
  flag: HTMLElement
}

export function makeFlagMarker(color: string): FlagParts {
  const outer = document.createElement('div')
  const content = document.createElement('div')
  content.style.width = '16px'
  content.style.height = '24px'
  content.style.position = 'relative'
  content.style.transition =
    'transform 120ms ease, box-shadow 120ms ease'
  const pole = document.createElement('div')
  pole.style.cssText =
    'position:absolute;left:6px;top:0;width:2px;height:24px;background:#FBF8F1'
  const flag = document.createElement('div')
  flag.style.cssText = `position:absolute;left:8px;top:1px;width:9px;height:7px;background:${color};transition:background 120ms ease`
  const base = document.createElement('div')
  base.style.cssText =
    'position:absolute;left:5px;top:22px;width:4px;height:2px;border-radius:1px;background:#FBF8F1'
  content.appendChild(pole)
  content.appendChild(flag)
  content.appendChild(base)
  outer.appendChild(content)
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
