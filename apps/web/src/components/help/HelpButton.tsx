import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHelpTopic, type HelpTopicId } from '@oga/core'

// Pull-only contextual help. Renders a small "?" button; clicking toggles an
// absolutely-positioned panel (no popover lib — matches the app's hand-rolled
// panel precedent). Closes on Escape or outside click.
// topicId is the HelpTopicId union (compile error on an unknown id, not a
// silently-missing "?").
// Below this viewport width the panel switches from button-anchored (left:0)
// to viewport-anchored (left/right:16) — the anchored width (300, or 90vw
// on truly tiny viewports) can otherwise run past the right edge (#panel
// clipping — see the useLayoutEffect below).
const NARROW_BREAKPOINT = 480

export function HelpButton({ topicId }: { topicId: HelpTopicId }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < NARROW_BREAKPOINT,
  )
  const topic = getHelpTopic(topicId)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  // Re-measure on every open (viewport width can change between opens, e.g.
  // rotation or a resized window) rather than once on mount.
  useLayoutEffect(() => {
    if (!open) return
    setNarrow(window.innerWidth < NARROW_BREAKPOINT)
  }, [open])

  if (!topic) return null

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label={`Help: ${topic.title}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="text-caddie-ink-mute hover:text-caddie-ink"
        style={{
          width: 24, height: 24, borderRadius: 999, border: '1px solid #D9D2BF',
          background: 'transparent', fontSize: 14, lineHeight: 1, cursor: 'pointer',
        }}
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          className="bg-caddie-surface text-caddie-ink"
          style={
            narrow
              ? // Viewport-anchored below the breakpoint: fixed left/right
                // margins guarantee the panel never runs past either edge,
                // regardless of where the "?" button sits in the header.
                {
                  position: 'fixed', top: 64, left: 16, right: 16, zIndex: 40,
                  border: '1px solid #D9D2BF', borderRadius: 4, padding: 16,
                  boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                }
              : {
                  // Opens rightward from the button (left:0). The "?" sits
                  // just right of the <h1> (left of the header), so a
                  // right:0 panel would clip off-screen at desktop widths.
                  position: 'absolute', top: 30, left: 0, width: 300, maxWidth: '90vw', zIndex: 40,
                  border: '1px solid #D9D2BF', borderRadius: 4, padding: 16,
                  boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                }
          }
        >
          <div className="font-serif" style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            {topic.title}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.5 }}>{topic.body}</p>
          {topic.articleId && (
            <Link
              to={`/learn/${topic.articleId}`}
              className="text-caddie-accent"
              style={{ fontSize: 13, fontWeight: 500, display: 'inline-block', marginTop: 10 }}
              onClick={() => setOpen(false)}
            >
              Learn more →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
