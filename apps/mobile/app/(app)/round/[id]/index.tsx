import { Redirect, useLocalSearchParams } from 'expo-router'

export default function RoundIndex() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Redirect href={`/(app)/round/${id}/hole/1`} />
}
