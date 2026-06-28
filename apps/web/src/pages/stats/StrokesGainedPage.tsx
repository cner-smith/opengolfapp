import { useMemo, useState } from 'react'
import { clubDistanceStats } from '@oga/core'
import { useDetailedStats } from '../../hooks/useDetailedStats'
import { EmptyState, Skeleton } from './components/Section'
import { Segmented } from './components/Segmented'
import { StrokesGainedSection } from './sections/StrokesGainedSection'
import { ScoringSection } from './sections/ScoringSection'
import { BallStrikingSection } from './sections/BallStrikingSection'
import { ShortGameSection } from './sections/ShortGameSection'
import { PatternsSection } from './sections/PatternsSection'
import { ClubDistancesSection } from './sections/ClubDistancesSection'

const N_OPTIONS: readonly number[] = [5, 10, 20]

export function StrokesGainedPage() {
  const [n, setN] = useState<number>(10)
  const stats = useDetailedStats(n)
  // Per-club total distance, from every tracked shot's start→end across the
  // loaded rounds (same flatten the mobile Stats screen feeds clubDistanceStats).
  const clubDistances = useMemo(
    () =>
      clubDistanceStats(
        stats.rounds.flatMap((r) =>
          (r.hole_scores ?? []).flatMap((hs) => hs.shots ?? []),
        ),
      ),
    [stats.rounds],
  )

  return (
    <div>
      <div
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
        style={{ marginBottom: 28 }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Performance ledger
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
          >
            Stats
          </h1>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}
          >
            {stats.data
              ? `Across the last ${stats.data.rounds} round${stats.data.rounds === 1 ? '' : 's'} · ${stats.data.holesPlayed} holes scored.`
              : 'Per-category strokes vs. the bracket baseline.'}
          </div>
        </div>
        <Segmented
          value={n}
          options={N_OPTIONS}
          onChange={setN}
          renderLabel={(v) => `Last ${v}`}
        />
      </div>

      {stats.isLoading ? (
        <Skeleton />
      ) : !stats.data ? (
        <EmptyState />
      ) : (
        <>
          <StrokesGainedSection data={stats.data} />
          <ScoringSection data={stats.data} />
          <BallStrikingSection data={stats.data} />
          <ShortGameSection data={stats.data} />
          <PatternsSection data={stats.data} />
          <ClubDistancesSection clubDistances={clubDistances} />
        </>
      )}
    </div>
  )
}
