import { useEffect, useRef, useState } from 'react'
import { formatHandicapIndex, parseHandicapIndex } from '@oga/core'
import { OnboardingButtons, StepHeading } from './shared'

// The index the profile accepts (OnboardingPage.saveProfile). The slider
// covers the usual range; the keys and the typed number reach the rest.
const MIN = -10
const MAX = 54
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n * 10) / 10))

function bracketLabel(handicap: number): { name: string; description: string } {
  if (handicap < 0) return { name: 'Plus handicap', description: 'Better than scratch' }
  if (handicap <= 2) return { name: 'Scratch', description: 'Bracket: 0–2 handicap' }
  if (handicap <= 7)
    return { name: 'Single digit', description: 'Bracket: 3–7 handicap' }
  if (handicap <= 12)
    return { name: 'Low double digit', description: 'Bracket: 8–12 handicap' }
  if (handicap <= 17)
    return { name: 'Mid double digit', description: 'Bracket: 13–17 handicap' }
  if (handicap <= 22) return { name: 'High teens', description: 'Bracket: 18–22 handicap' }
  if (handicap <= 27)
    return { name: 'Twenty-something', description: 'Bracket: 23–27 handicap' }
  return { name: 'New to scoring', description: 'Bracket: 28+ handicap' }
}

export function Step2Handicap({
  value,
  onChange,
  onBack,
  onContinue,
}: {
  value: number
  onChange: (v: number) => void
  onBack: () => void
  onContinue: () => void
}) {
  const bracket = bracketLabel(value)
  // The big number is a button until pressed, then a text field.
  const [typing, setTyping] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (typing !== null) inputRef.current?.select()
  }, [typing !== null]) // eslint-disable-line react-hooks/exhaustive-deps -- select once on entering edit mode, not on every keystroke

  const commit = () => {
    const n = typing === null ? null : parseHandicapIndex(typing)
    if (n !== null) onChange(clamp(n))
    setTyping(null)
  }

  return (
    <div>
      <StepHeading
        title="What's your handicap index?"
        subtitle="It calibrates the strokes-gained baseline. No official number — your best guess is fine."
      />
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          borderBottom: '1px solid #D9D2BF',
          padding: '28px 0',
          textAlign: 'center',
          marginBottom: 22,
        }}
      >
        <div className="flex items-center justify-center" style={{ gap: 22 }}>
          <StepKey label="Lower by a tenth" glyph="−" onStep={() => onChange(clamp(value - 0.1))} />
          <div style={{ width: 170, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {typing === null ? (
              <button
                type="button"
                onClick={() => setTyping(formatHandicapIndex(value))}
                aria-label={`Handicap index ${formatHandicapIndex(value)}. Press to type it`}
                className="font-serif tabular text-caddie-ink"
                style={{ fontSize: 64, fontStyle: 'italic', fontWeight: 500, lineHeight: 1, background: 'none', border: 'none', cursor: 'text', padding: 0 }}
              >
                <span key={value} className="onb-tick" style={{ display: 'inline-block' }}>
                  {formatHandicapIndex(value)}
                </span>
              </button>
            ) : (
              <input
                ref={inputRef}
                inputMode="decimal"
                aria-label="Handicap index"
                value={typing}
                onChange={(e) => setTyping(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') setTyping(null)
                }}
                className="font-serif tabular text-caddie-ink"
                style={{
                  width: 160,
                  fontSize: 56,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  lineHeight: 1,
                  textAlign: 'center',
                  background: '#FBF8F1',
                  border: '1px solid #1C211C',
                  borderRadius: 3,
                  boxShadow: '2px 2px 0 #1C211C',
                  outline: 'none',
                }}
              />
            )}
          </div>
          <StepKey label="Raise by a tenth" glyph="+" onStep={() => onChange(clamp(value + 0.1))} />
        </div>
        <div className="font-serif text-caddie-ink-dim" style={{ fontSize: 17, marginTop: 12 }}>
          {bracket.name}
        </div>
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 4 }}>
          {bracket.description}
        </div>
      </div>
      <input
        type="range"
        min={-5}
        max={MAX}
        step={0.1}
        value={value}
        aria-label="Handicap index"
        aria-valuetext={formatHandicapIndex(value)}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        style={{
          width: '100%',
          accentColor: '#1F3D2C',
          marginBottom: 8,
        }}
      />
      <div className="text-caddie-ink-dim flex justify-between" style={{ fontSize: 13 }}>
        <span>+5</span>
        <span>54</span>
      </div>
      <OnboardingButtons onBack={onBack} onContinue={onContinue} canContinue={true} />
    </div>
  )
}

// A raised −/+ key: one tenth per press; held down, it keeps stepping.
function StepKey({ label, glyph, onStep }: { label: string; glyph: string; onStep: () => void }) {
  const step = useRef(onStep)
  step.current = onStep
  const timers = useRef<{ delay?: number; repeat?: number }>({})
  const stop = () => {
    window.clearTimeout(timers.current.delay)
    window.clearInterval(timers.current.repeat)
    timers.current = {}
  }
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      aria-label={label}
      className="key font-serif"
      style={{ width: 44, minHeight: 44, padding: 0, fontSize: 22, fontWeight: 500 }}
      onClick={(e) => {
        // A pointer press already stepped on pointerdown; keyboard steps here.
        if (e.detail === 0) step.current()
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        step.current()
        timers.current.delay = window.setTimeout(() => {
          timers.current.repeat = window.setInterval(() => step.current(), 80)
        }, 400)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {glyph}
    </button>
  )
}
