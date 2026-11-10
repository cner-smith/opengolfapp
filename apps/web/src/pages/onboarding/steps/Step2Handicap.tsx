import { useEffect, useRef, useState } from 'react'
import {
  formatHandicapIndex,
  handicapIndexField,
  parseHandicapIndex,
  PLUS_HANDICAP_EXPLAINER,
  PLUS_HANDICAP_QUESTION,
  plusHandicapToggle,
  stepPlusHandicap,
  typedHandicapSign,
  type PlusHandicapToggle,
} from '@oga/core'
import { OnboardingButtons, StepHeading } from './shared'

// The index the profile accepts (stored -10, a plus 10, to 54). The ruler,
// keys and typed number set the number; the Plus handicap key sets its sign.
const MAX = 54
const PLUS_MAX = 10
// A ruler position: the thumb's centre runs 9 px in from each end.
const at = (n: number) => `calc(9px + (100% - 18px) * ${n / MAX})`
// The stored index for a number and a sign (a plus is stored negative).
const signedIndex = (n: number, plus: boolean) => {
  const m = Math.min(plus ? PLUS_MAX : MAX, Math.max(0, Math.round(n * 10) / 10))
  return plus ? -m || 0 : m
}

export function bracketLabel(handicap: number): string {
  if (handicap < 0) return 'Plus handicap'
  if (handicap <= 2) return 'Scratch'
  if (handicap <= 7) return 'Single digit'
  if (handicap <= 12) return 'Low double digit'
  if (handicap <= 17) return 'Mid double digit'
  if (handicap <= 22) return 'High teens'
  if (handicap <= 27) return 'Twenty-something'
  return 'New to scoring'
}

export function Step2Handicap({
  value,
  seeded,
  onChange,
  onBack,
  onContinue,
}: {
  value: number
  /** Still the start Step 1 picked for them: say so. */
  seeded: boolean
  onChange: (v: number) => void
  onBack: () => void
  onContinue: () => void
}) {
  const bracket = bracketLabel(value)
  const [plusToggle, setPlusToggle] = useState(() => plusHandicapToggle(value))
  const setNumber = (n: number) => onChange(signedIndex(n, plusToggle.plus))
  const stepPlus = (action: Parameters<typeof stepPlusHandicap>[1]) => {
    const next: PlusHandicapToggle = stepPlusHandicap(plusToggle, action)
    setPlusToggle(next)
    if (next.plus !== plusToggle.plus) onChange(signedIndex(Math.abs(value), next.plus))
  }
  // The big number is a button until pressed, then a text field.
  const [typing, setTyping] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (typing !== null) inputRef.current?.select()
  }, [typing !== null]) // eslint-disable-line react-hooks/exhaustive-deps -- select once on entering edit mode, not on every keystroke

  const commit = () => {
    const n = typing === null ? null : parseHandicapIndex(typing)
    if (n !== null) setNumber(Math.abs(n))
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
          <StepKey label="Lower by a tenth" glyph="−" onStep={() => setNumber(Math.abs(value) - 0.1)} />
          <div style={{ width: 170, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {typing === null ? (
              <button
                type="button"
                onClick={() => setTyping(handicapIndexField(value).text)}
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
                onChange={(e) => {
                  const typed = typedHandicapSign(e.target.value)
                  setTyping(typed.text)
                  if (typed.plus) stepPlus('on')
                }}
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
          <StepKey label="Raise by a tenth" glyph="+" onStep={() => setNumber(Math.abs(value) + 0.1)} />
        </div>
        <div className="font-serif text-caddie-ink-dim" style={{ fontSize: 17, marginTop: 12 }}>
          {bracket}
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            aria-pressed={plusToggle.plus}
            onClick={() => stepPlus(plusToggle.plus ? 'off' : 'on')}
            className="key set-key"
            style={{ fontWeight: plusToggle.plus ? 600 : 500 }}
          >
            Plus handicap
          </button>
        </div>
        {plusToggle.asking ? (
          // Asked in place, and neither key is the forest primary: an
          // amateur shouldn't turn this on by accident.
          <div role="group" aria-label={PLUS_HANDICAP_QUESTION} style={{ marginTop: 14, maxWidth: 380, marginInline: 'auto' }}>
            <p className="font-serif text-caddie-ink" style={{ fontSize: 17, lineHeight: 1.3 }}>
              {PLUS_HANDICAP_QUESTION}
            </p>
            <p className="text-caddie-ink-dim" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
              {PLUS_HANDICAP_EXPLAINER}
            </p>
            <div className="flex justify-center" style={{ gap: 8, marginTop: 10 }}>
              <button type="button" className="key set-key" onClick={() => stepPlus('confirm')}>
                Turn on
              </button>
              <button type="button" className="key set-key" onClick={() => stepPlus('cancel')}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {seeded && (
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5, maxWidth: 360, marginInline: 'auto' }}>
            No handicap yet? Keep this: it&rsquo;s typical for golfers like you, and you can change it any time in Profile.
          </p>
        )}
      </div>
      {/* A printed ruler: a tick every stroke, a longer one every five, numbers
          every ten; the pick is a green pencil line across it. */}
      <div style={{ position: 'relative', height: 52, marginBottom: 4 }}>
        {Array.from({ length: MAX + 1 }, (_, t) => {
          return (
            <span
              key={t}
              aria-hidden
              className="onb-ruler-tick"
              style={{ left: at(t), height: t % 10 === 0 ? 16 : t % 5 === 0 ? 11 : 6 }}
            />
          )
        })}
        {[0, 10, 20, 30, 40, 50].map((t) => (
          <span
            key={t}
            aria-hidden
            className="font-serif tabular text-caddie-ink-dim onb-ruler-num"
            style={{ left: at(t) }}
          >
            {t}
          </span>
        ))}
        <input
          type="range"
          min={0}
          max={MAX}
          step={0.1}
          value={Math.abs(value)}
          aria-label="Handicap index"
          aria-valuetext={formatHandicapIndex(value)}
          onChange={(e) => setNumber(Number(e.target.value))}
          className="onb-ruler"
        />
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
