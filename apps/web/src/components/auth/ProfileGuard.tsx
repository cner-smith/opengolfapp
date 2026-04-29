import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type ProfileState = 'loading' | 'complete' | 'incomplete'

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [profileState, setProfileState] = useState<ProfileState>('loading')

  useEffect(() => {
    if (authLoading) return
    if (!user) return

    supabase
      .from('profiles')
      .select('skill_level, goal')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data || !data.skill_level || !data.goal) {
          setProfileState('incomplete')
        } else {
          setProfileState('complete')
        }
      })
  }, [user, authLoading])

  if (authLoading || profileState === 'loading') return null
  if (!user) return <Navigate to="/login" replace />
  if (profileState === 'incomplete') return <Navigate to="/onboarding" replace />
  return <>{children}</>
}
