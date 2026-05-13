import { useLocalSearchParams, useRouter } from 'expo-router'
import LiveRoundSession from '../../../../../components/round/LiveRoundSession'

// Thin route wrapper. The live-round screen body lives in
// LiveRoundSession so it can host a resident MapView across hole
// transitions — see #264. Today this route still owns the URL contract
// (path-segmented hole number); a later commit moves the mount point
// to /round/[id]?hole=N and turns this file into a redirect.
export default function HoleScreen() {
  const { id, number, mode } = useLocalSearchParams<{
    id: string
    number: string
    mode?: string
  }>()
  const router = useRouter()
  const holeNumber = Number(number)
  return (
    <LiveRoundSession
      roundId={id}
      initialHoleNumber={holeNumber}
      mode={mode === 'past' ? 'past' : 'live'}
      onHoleChange={(next) =>
        router.replace(`/(app)/round/${id}/hole/${next}`)
      }
    />
  )
}
