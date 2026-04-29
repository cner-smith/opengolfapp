import { useParams } from 'react-router-dom'

export function RoundDetailPage() {
  const { id } = useParams()
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-fairway-700">Round {id}</h1>
      <p className="text-gray-600">Per-round detail view (Phase 3).</p>
    </div>
  )
}
