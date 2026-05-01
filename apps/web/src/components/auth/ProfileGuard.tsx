import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type ProfileState = 'loading' | 'complete' | 'incomplete' | 'error'

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [profileState, setProfileState] = useState<ProfileState>('loading')

  useEffect(() => {
    if (authLoading) return
    if (!user) return

    let active = true
    supabase
      .from('profiles')
      .select('skill_level, goal')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          // Real failure (network, RLS misconfig). Don't punish the user
          // by punting them to onboarding — surface the issue and stop.
          // eslint-disable-next-line no-console
          console.error('[ProfileGuard]', error.message)
          setProfileState('error')
          return
        }
        // No row, or row missing required onboarding fields.
        if (!data || !data.skill_level || !data.goal) {
          setProfileState('incomplete')
        } else {
          setProfileState('complete')
        }
      })
    return () => {
      active = false
    }
  }, [user, authLoading])

  if (authLoading || profileState === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          color: 'var(--caddie-ink-dim)',
          backgroundColor: 'var(--caddie-bg)',
        }}
      >
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (profileState === 'error') {
    // Soft error screen so a transient network blip doesn't redirect a
    // fully-onboarded user to /onboarding (which would clobber their
    // profile on save).
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 14,
          fontFamily: 'Inter, sans-serif',
          backgroundColor: 'var(--caddie-bg)',
          color: 'var(--caddie-ink)',
          padding: 28,
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 22 }}>
          Couldn't load your profile.
        </div>
        <div style={{ fontSize: 13, color: 'var(--caddie-ink-dim)' }}>
          Check your connection and reload.
        </div>
      </div>
    )
  }
  if (profileState === 'incomplete') return <Navigate to="/onboarding" replace />
  return <>{children}</>
}
