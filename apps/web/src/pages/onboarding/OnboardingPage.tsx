import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Facility, Goal, SkillLevel } from '@oga/core'
import { useUpdateProfile } from '../../hooks/useProfile'
import { Step1Skill } from './steps/Step1Skill'
import { Step2Handicap } from './steps/Step2Handicap'
import { Step3Goal } from './steps/Step3Goal'
import { Step4Details } from './steps/Step4Details'
import { Step5Summary } from './steps/Step5Summary'

export interface OnboardingDraft {
  skillLevel: SkillLevel | null
  handicap: number
  goal: Goal | null
  playFrequency: string | null
  facilities: Facility[]
  playStyle: 'casual' | 'mixed' | 'competitive' | null
}

const TOTAL_STEPS = 5

export function OnboardingPage() {
  const navigate = useNavigate()
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

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1)
  }
  function back() {
    if (step > 1) setStep(step - 1)
    else navigate('/login')
  }

  async function save() {
    setError(null)
    try {
      await updateProfile.mutateAsync({
        skill_level: draft.skillLevel,
        handicap_index: draft.handicap,
        goal: draft.goal,
        play_frequency: draft.playFrequency,
        facilities: draft.facilities,
        play_style: draft.playStyle,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
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
            onSave={save}
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
