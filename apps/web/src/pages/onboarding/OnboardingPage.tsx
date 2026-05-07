import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_BAG, type Facility, type Goal, type SkillLevel } from '@oga/core'
import { seedDefaultBag } from '@oga/supabase'
import { useUpdateProfile } from '../../hooks/useProfile'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Step1Skill } from './steps/Step1Skill'
import { Step2Handicap } from './steps/Step2Handicap'
import { Step3Goal } from './steps/Step3Goal'
import { Step4Details } from './steps/Step4Details'
import { Step5Summary } from './steps/Step5Summary'
import { Step6Bag } from './steps/Step6Bag'
import { toUserMessage } from '../../lib/errors'

export interface OnboardingDraft {
  skillLevel: SkillLevel | null
  handicap: number
  goal: Goal | null
  playFrequency: string | null
  facilities: Facility[]
  playStyle: 'casual' | 'mixed' | 'competitive' | null
}

const TOTAL_STEPS = 6

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

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1)
  }
  function back() {
    if (step > 1) setStep(step - 1)
    else navigate('/login')
  }

  // Step 5 → save profile, advance to bag step. Step 6 → save bag (or
  // skip), navigate home. Splitting the saves keeps the bag truly
  // optional: a user who skips never inserts a user_clubs row.
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
      navigate('/dashboard', { replace: true })
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
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setSavingBag(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-caddie-bg">
      <div
        className="w-full"
        style={{
          maxWidth: 520,
          padding: '60px 24px 40px',
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 22, fontWeight: 500 }}
          >
            OGA
          </div>
          <div className="kicker" style={{ marginTop: 4 }}>
            Open Golf App
          </div>
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} />

        {step === 1 && (
          <Step1Skill
            value={draft.skillLevel}
            onChange={(skillLevel) => setDraft((d) => ({ ...d, skillLevel }))}
            onBack={back}
            onContinue={next}
          />
        )}
        {step === 2 && (
          <Step2Handicap
            value={draft.handicap}
            onChange={(handicap) => setDraft((d) => ({ ...d, handicap }))}
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
      </div>
    </div>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>
        Step {current} of {total}
      </div>
      <div
        style={{
          width: '100%',
          height: 1,
          backgroundColor: '#D9D2BF',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${(current / total) * 100}%`,
            height: 1,
            backgroundColor: '#1F3D2C',
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  )
}
