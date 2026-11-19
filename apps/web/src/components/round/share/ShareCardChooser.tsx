import { useEffect, useRef, useState, type ComponentType } from 'react'
import { toBlob } from 'html-to-image'
import type { ShareCardModel } from '@oga/core'
import { Rocker } from '../../ui/Rocker'
import { toUserMessage } from '../../../lib/errors'
import { CARD_H, CARD_W, TONES, type ShareTone, type StyleProps } from './parts'
import { ScorecardStyle } from './ScorecardStyle'
import { YardageBookStyle } from './YardageBookStyle'
import { ParLineStyle } from './ParLineStyle'
import { HeroStyle } from './HeroStyle'
import { StrokesGainedStyle } from './StrokesGainedStyle'

// The round share card chooser (#1437): five styles, light or dark, the
// person picks one and shares it as a 1080 × 1350 PNG.

export type ShareStyleId = 'scorecard' | 'yardage' | 'par-line' | 'hero' | 'sg'

const STYLES: { id: ShareStyleId; label: string; Card: ComponentType<StyleProps>; needsSG?: boolean }[] = [
  { id: 'scorecard', label: 'Scorecard', Card: ScorecardStyle },
  { id: 'yardage', label: 'Yardage book', Card: YardageBookStyle },
  { id: 'par-line', label: 'Par line', Card: ParLineStyle },
  { id: 'hero', label: 'Big number', Card: HeroStyle },
  { id: 'sg', label: 'Strokes gained', Card: StrokesGainedStyle, needsSG: true },
]

const TONE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ShareTone; label: string }[]

const PREFS_KEY = 'oga.share-card'
const DEFAULT_PREFS = { style: 'hero' as ShareStyleId, tone: 'light' as ShareTone }

function readPrefs(): { style: ShareStyleId; tone: ShareTone } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? 'null') as { style?: string; tone?: string } | null
    return {
      style: STYLES.some((s) => s.id === raw?.style) ? (raw!.style as ShareStyleId) : DEFAULT_PREFS.style,
      tone: raw?.tone === 'dark' ? 'dark' : DEFAULT_PREFS.tone,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: { style: ShareStyleId; tone: ShareTone }) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

export function ShareCard({ style, model, tone }: { style: ShareStyleId } & StyleProps) {
  const { Card } = STYLES.find((s) => s.id === style)!
  return <Card model={model} tone={tone} />
}

// Font faces the cards draw with: loaded before a capture so the PNG never
// falls back to a system face.
const FACES = [
  '400 16px Fraunces',
  '500 16px Fraunces',
  'italic 400 16px Fraunces',
  'italic 500 16px Fraunces',
  '400 16px Epilogue',
  '500 16px Inconsolata',
  '400 16px Kalam',
]

function capture(node: HTMLElement, tone: ShareTone) {
  return Promise.all(FACES.map((f) => document.fonts.load(f)))
    .catch(() => undefined)
    .then(() => toBlob(node, { width: CARD_W, height: CARD_H, pixelRatio: 2, backgroundColor: TONES[tone].bg }))
}

interface ShareCardChooserProps {
  open: boolean
  model: ShareCardModel
  /** The PNG's name before the style, "bear-creek-golf-club-2026-10-31". */
  filename: string
  onClose: () => void
}

export function ShareCardChooser({ open, model, filename, onClose }: ShareCardChooserProps) {
  const [prefs, setPrefs] = useState(readPrefs)
  const choices = STYLES.filter((s) => !s.needsSG || model.sg != null)
  // A remembered SG style falls back to the default on a round without SG.
  const style = choices.some((s) => s.id === prefs.style) ? prefs.style : DEFAULT_PREFS.style
  const { tone } = prefs
  const choose = (next: Partial<typeof prefs>) => {
    const p = { style, tone, ...next }
    setPrefs(p)
    writePrefs(p)
  }

  // Pre-rasterise the chosen card to a Blob so Share hands navigator.share()
  // a ready file with NO awaited work between the click and the call: the
  // Web Share API needs a live user activation, which an await inside the
  // click handler expires on iOS Safari.
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const key = `${style}:${tone}`
  const blobRef = useRef<{ key: string; model: ShareCardModel; blob: Blob } | null>(null)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const node = nodeRef.current
    if (!open || !node) return
    let cancelled = false
    setReadyKey(null)
    capture(node, tone)
      .then((blob) => {
        if (cancelled) return
        blobRef.current = blob ? { key, model, blob } : null
        setReadyKey(key)
      })
      .catch(() => {
        if (!cancelled) setReadyKey(key)
      })
    return () => {
      cancelled = true
    }
  }, [open, key, tone, model])

  // Focus moves into the dialog on open and back to Share on close.
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const back = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => back?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    setError(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const previewRef = useRef<HTMLDivElement | null>(null)
  const scale = usePreviewScale(previewRef, open)
  // Five thumbnails fit one row on a phone.
  const thumb = scale < 0.6 ? 0.09 : 0.13

  // Opens the native share sheet with the PNG, falling back to a download
  // where file sharing isn't supported or share() fails for any reason other
  // than the person dismissing the sheet.
  const share = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const held = blobRef.current
      let blob = held && held.key === key && held.model === model ? held.blob : null
      if (!blob && nodeRef.current) blob = await capture(nodeRef.current, tone)
      if (!blob) throw new Error('Could not render the card image.')
      const name = `${filename}-${style}.png`
      const file = new File([blob], name, { type: 'image/png' })
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'OGA Scorecard' })
          return
        } catch (err) {
          if ((err as Error).name === 'AbortError') return
        }
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      // Firefox and older Safari only honour downloads from an attached anchor.
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  const canShareFiles = typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
  const ready = readyKey === key
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your card"
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto sm:items-center"
      style={{ background: 'rgba(28,33,28,0.55)', padding: 16 }}
      onClick={onClose}
    >
      {/* Off-screen, full-size render target for the rasteriser. */}
      <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }}>
        <div ref={nodeRef} style={{ width: CARD_W, height: CARD_H }}>
          <ShareCard style={style} model={model} tone={tone} />
        </div>
      </div>
      <div
        ref={panelRef}
        tabIndex={-1}
        className="paper-tile w-full outline-none"
        style={{ maxWidth: 560, padding: 22, boxShadow: '3px 3px 0 rgba(28,33,28,0.55)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-serif italic text-caddie-ink" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.25 }}>
          Share your card
        </div>
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, margin: '2px 0 14px' }}>
          Pick a style. An image of it, ready for the group chat.
        </div>
        <div ref={previewRef} className="flex justify-center">
          <Scaled scale={scale} label={`${STYLES.find((s) => s.id === style)!.label}, ${tone}`}>
            <ShareCard style={style} model={model} tone={tone} />
          </Scaled>
        </div>
        <div role="group" aria-label="Card style" className="flex justify-center" style={{ gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          {choices.map((s) => {
            const on = s.id === style
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                aria-label={s.label}
                onClick={() => choose({ style: s.id })}
                className="flex flex-col items-center text-caddie-ink"
                style={{ gap: 5, background: 'transparent', border: 'none', padding: 2, cursor: 'pointer' }}
              >
                <span
                  style={{
                    display: 'block',
                    outline: on ? '2px solid #1C211C' : '1px solid #D9D2BF',
                    outlineOffset: on ? 2 : 0,
                    borderRadius: 2,
                  }}
                >
                  <Scaled scale={thumb}>
                    <s.Card model={model} tone={tone} />
                  </Scaled>
                </span>
                <span style={{ fontSize: 11, fontWeight: on ? 600 : 400, maxWidth: CARD_W * thumb + 4, lineHeight: 1.2 }}>{s.label}</span>
              </button>
            )
          })}
        </div>
        <Rocker
          options={TONE_OPTIONS}
          value={tone}
          onChange={(t) => choose({ tone: t })}
          label="Card paper"
          className="mt-4"
        />
        {error && (
          <p role="alert" className="text-caddie-neg" style={{ fontSize: 13, lineHeight: 1.45, marginTop: 12 }}>
            {error}
          </p>
        )}
        <div className="flex justify-end" style={{ gap: 10, marginTop: 18, paddingBottom: 3 }}>
          <button type="button" onClick={onClose} className="key">
            Cancel
          </button>
          <button type="button" onClick={share} disabled={busy || !ready} className="key key-primary">
            {!ready ? 'Rendering…' : busy ? 'Sharing…' : canShareFiles ? 'Share image' : 'Download image'}
          </button>
        </div>
      </div>
    </div>
  )
}

// A card drawn at full size and scaled down for the screen.
function Scaled({ scale, label, children }: { scale: number; label?: string; children: React.ReactNode }) {
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: CARD_W * scale, height: CARD_H * scale, overflow: 'hidden', flexShrink: 0, pointerEvents: 'none' }}
    >
      <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
  )
}

// The big preview: up to 0.6 of the card, narrower on a phone, shorter on a
// short window so the keys stay on screen.
function usePreviewScale(ref: React.RefObject<HTMLDivElement | null>, open: boolean) {
  const [scale, setScale] = useState(0.6)
  useEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const fit = () => {
      const byWidth = el.clientWidth / CARD_W
      // 330 px: the dialog's title, thumbnails, paper switch and keys.
      const byHeight = (window.innerHeight - 330) / CARD_H
      setScale(Math.max(0.3, Math.min(0.6, byWidth, byHeight)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [ref, open])
  return scale
}
