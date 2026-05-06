import type { Database } from '@oga/supabase'
import { ShotMiniMap } from '../../round/ShotMiniMap'

type ShotRow = Database['public']['Tables']['shots']['Row']

interface ShotMiniMapPanelProps {
  editingRow: ShotRow | null
  editingNext: ShotRow | null | undefined
  onChangeStart: (point: { lat: number; lng: number }) => void | Promise<void>
}

// Mini-map shows only when editing a saved shot with start coords;
// new-shot drafts hide it because there's nothing on the map yet.
export function ShotMiniMapPanel({
  editingRow,
  editingNext,
  onChangeStart,
}: ShotMiniMapPanelProps) {
  if (
    !editingRow ||
    editingRow.start_lat == null ||
    editingRow.start_lng == null
  ) {
    return null
  }
  return (
    <ShotMiniMap
      shotNumber={editingRow.shot_number}
      startLat={editingRow.start_lat}
      startLng={editingRow.start_lng}
      endLat={editingNext?.start_lat ?? editingRow.end_lat}
      endLng={editingNext?.start_lng ?? editingRow.end_lng}
      aimLat={editingRow.aim_lat}
      aimLng={editingRow.aim_lng}
      onChangeStart={onChangeStart}
    />
  )
}
