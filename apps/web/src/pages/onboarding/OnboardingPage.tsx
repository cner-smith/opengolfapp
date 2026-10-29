import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_BAG, type Facility, type Goal, type SkillLevel } from '@oga/core'
import { seedDefaultBag } from '@oga/supabase'
import { useUpdateProfile } from '../../hooks/useProfile'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { supabase } from '../../lib/supabase'
import { Step1Skill } from './steps/Step1Skill'
import { Step2Handicap } from './steps/Step2Handicap'
import { Step3Goal } from './steps/Step3Goal'
import { Step4Details } from './steps/Step4Details'
import { Step5Summary } from './steps/Step5Summary'
import { Step6Bag } from './steps/Step6Bag'
import { Step7Import } from './steps/Step7Import'
import { toUserMessage } from '../../lib/errors'
import { Wordmark } from '../../components/landing/Wordmark'

export interface OnboardingDraft {
  skillLevel: SkillLevel | null
  handicap: number
  goal: Goal | null
  playFrequency: string | null
  facilities: Facility[]
  playStyle: 'casual' | 'mixed' | 'competitive' | null
}

const TOTAL_STEPS = 7

// Where Step 2 starts for each Step 1 answer, until the golfer moves it.
const SEED_HANDICAP: Record<SkillLevel, number> = { beginner: 36, casual: 28, developing: 18, competitive: 6 }

export function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const updateProfile = useUpdateProfile()
  const [step, setStep] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<OnboardingDraft>({
    skillLevel: null,
    handicap: 15,
    goal: null,
    playFrequency: null,
    facilities: [],
    playStyle: null,
  })
  // Bag step starts with all DEFAULT_BAG clubs selected. User toggles
  // off any they don't carry. Skipping the step doesn't seed at all —
  // the bag stays empty and ShotEntryModal falls back to DEFAULT_BAG
  // until the user explicitly populates it.
  const [bagSelection, setBagSelection] = useState<Set<string>>(
    () => new Set(DEFAULT_BAG.map((c) => c.club_type)),
  )
  const [savingBag, setSavingBag] = useState(false)
  const [handicapTouched, setHandicapTouched] = useState(false)
  useDocumentTitle(`${stepLabel(step)} · OGA`)

  // Each step is a new component, so Continue/Back unmount the focused key
  // and focus falls to <body>. Move it to the new step's heading instead
  // (not on the first paint: nothing has changed yet).
  const pageRef = useRef<HTMLDivElement>(null)
  const shownStep = useRef(step)
  useEffect(() => {
    if (shownStep.current === step) return
    shownStep.current = step
    pageRef.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [step])

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1)
  }
  // Step 1 has no Back: the user is signed in, so there is nothing behind it.
  function back() {
    if (step > 1) setStep(step - 1)
  }

  // Step 5 → save profile, advance to bag step. Step 6 → save bag (or
  // skip) and finish onboarding. Splitting the saves keeps the bag truly
  // optional: a user who skips never inserts a user_clubs row. Step 7 (import)
  // comes after the finish, so it only picks where the user lands.
  async function saveProfile() {
    setError(null)
    if (draft.handicap < -10 || draft.handicap > 54) {
      setError('Handicap must be between -10 and 54')
      return
    }
    try {
      await updateProfile.mutateAsync({
        skill_level: draft.skillLevel,
        handicap_index: draft.handicap,
        goal: draft.goal,
        play_frequency: draft.playFrequency,
        facilities: draft.facilities,
        play_style: draft.playStyle,
      })
      next()
    } catch (err) {
      setError(toUserMessage(err))
    }
  }

  async function saveBagAndFinish() {
    if (!user) return
    setError(null)
    setSavingBag(true)
    try {
      const filtered = DEFAULT_BAG.filter((c) => bagSelection.has(c.club_type))
      // Re-number sort_order so the user's pruned bag stays contiguous.
      const reseeded = filtered.map((c, idx) => ({
        club_type: c.club_type,
        name: c.name,
        sort_order: idx,
      }))
      await seedDefaultBag(supabase, user.id, reseeded)
      // Flip the gate AFTER the bag write so a failed bag save can't
      // strand the user on a half-completed onboarding.
      await updateProfile.mutateAsync({ onboarding_completed: true })
      setStep(7)
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setSavingBag(false)
    }
  }

  async function skipBag() {
    if (!user) return
    setError(null)
    setSavingBag(true)
    try {
      await updateProfile.mutateAsync({ onboarding_completed: true })
      setStep(7)
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setSavingBag(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-caddie-bg">
      <div
        ref={pageRef}
        className="w-full"
        style={{
          maxWidth: 520,
          padding: '60px 24px 40px',
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <Wordmark />
        </div>

        <StepIndicator current={step} />

        {step === 1 && (
          <Step1Skill
            value={draft.skillLevel}
            onChange={(skillLevel) =>
              setDraft((d) => ({ ...d, skillLevel, handicap: handicapTouched ? d.handicap : SEED_HANDICAP[skillLevel] }))
            }
            onContinue={next}
          />
        )}
        {step === 2 && (
          <Step2Handicap
            value={draft.handicap}
            seeded={!handicapTouched}
            onChange={(handicap) => {
              setHandicapTouched(true)
              setDraft((d) => ({ ...d, handicap }))
            }}
            onBack={back}
            onContinue={next}
          />
        )}
        {step === 3 && (
          <Step3Goal
            value={draft.goal}
            onChange={(goal) => setDraft((d) => ({ ...d, goal }))}
            onBack={back}
            onContinue={next}
          />
        )}
        {step === 4 && (
          <Step4Details
            frequency={draft.playFrequency}
            facilities={draft.facilities}
            playStyle={draft.playStyle}
            onChange={(patch) =>
              setDraft((d) => ({
                ...d,
                playFrequency: patch.frequency ?? d.playFrequency,
                facilities: patch.facilities ?? d.facilities,
                playStyle: patch.playStyle ?? d.playStyle,
              }))
            }
            onBack={back}
            onContinue={next}
          />
        )}
        {step === 5 && (
          <Step5Summary
            draft={draft}
            saving={updateProfile.isPending}
            error={error}
            onBack={back}
            onEdit={setStep}
            onSave={saveProfile}
          />
        )}
        {step === 6 && (
          <Step6Bag
            selected={bagSelection}
            onChange={setBagSelection}
            onBack={back}
            onContinue={saveBagAndFinish}
            onSkip={skipBag}
            busy={savingBag}
            error={error}
          />
        )}
        {step === 7 && (
          <Step7Import
            onImport={() => navigate('/rounds/import', { replace: true })}
            onSkip={() => navigate('/dashboard', { replace: true })}
          />
        )}
      </div>
    </div>
  )
}

// Five numbered steps; the bag is optional and the import offer comes after
// the profile is saved, so neither takes a number.
const NUMBERED_STEPS = 5

function stepLabel(current: number) {
  return current <= NUMBERED_STEPS ? `Step ${current} of ${NUMBERED_STEPS}` : current === 6 ? 'Optional: your bag' : 'One more thing'
}

function StepIndicator({ current }: { current: number }) {
  const label = stepLabel(current)
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex" style={{ gap: 4 }} aria-hidden>
        {Array.from({ length: NUMBERED_STEPS }, (_, i) => {
          const n = i + 1
          return (
            <div key={n} style={{ flex: 1, height: 3, backgroundColor: '#D9D2BF' }}>
              <div
                className="onb-seg"
                style={{
                  height: 3,
                  backgroundColor: n === current ? '#1F3D2C' : '#1C211C',
                  transform: n <= current ? 'scaleX(1)' : 'scaleX(0)',
                }}
              />
            </div>
          )
        })}
      </div>
      <div role="status" className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 10 }}>
        {label}
      </div>
    </div>
  )
}
