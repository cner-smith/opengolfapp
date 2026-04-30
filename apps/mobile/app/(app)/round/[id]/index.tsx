import { useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'

export default function RoundIndex() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  useEffect(() => {
    if (!id) return
    router.push(`/(app)/round/${id}/hole/1`)
  }, [id])

  return null
}
