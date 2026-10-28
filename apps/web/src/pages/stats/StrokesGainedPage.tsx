import { useMemo, useState } from 'react'
import { clubDistanceStats, isPartialRound } from '@oga/core'
import { useDetailedStats } from '../../hooks/useDetailedStats'
import { Skeleton } from './components/Section'
import { StatsPreview } from './components/StatsPreview'
import { Segmented } from './components/Segmented'
import { StrokesGainedSection } from './sections/StrokesGainedSection'
import { ScoringSection } from './sections/ScoringSection'
import { BallStrikingSection } from './sections/BallStrikingSection'
import { ShortGameSection } from './sections/ShortGameSection'
import { PatternsSection } from './sections/PatternsSection'
import { ClubDistancesSection } from './sections/ClubDistancesSection'
import { HelpButton } from '../../components/help/HelpButton'
import './stats.css'

const N_OPTIONS: readonly number[] = [5, 10, 20]

export function StrokesGainedPage() {
  const [n, setN] = useState<number>(10)
  const stats = useDetailedStats(n)
  // No rounds, or only partial ones (#1078): the sample page instead (#1076).
  const wholeCount = stats.rounds.filter((r) => !isPartialRound(r.hole_scores)).length
  const preview = !stats.data || wholeCount === 0
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
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between"
        style={{ gap: 16, marginBottom: 32 }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1
              className="font-serif text-caddie-ink"
              style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.1 }}
            >
              Stats
            </h1>
            <HelpButton topicId="stats" />
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 15, marginTop: 8, maxWidth: 560 }}
          >
            {stats.isLoading
              ? 'Per-category strokes vs. the bracket baseline.'
              : preview || !stats.data
                ? 'No full rounds yet. Here’s what this page shows once you have some.'
                : `Across the last ${wholeCount} round${wholeCount === 1 ? '' : 's'} · ${stats.data.holesPlayed} holes scored.`}
          </div>
        </div>
        <Segmented
          value={n}
          options={N_OPTIONS}
          onChange={setN}
          renderLabel={(v) => `Last ${v}`}
          label="Rounds to include"
        />
      </div>

      {stats.isLoading ? (
        <Skeleton />
      ) : preview || !stats.data ? (
        <StatsPreview />
      ) : (
        <>
          <StrokesGainedSection data={stats.data} wholeCount={wholeCount} />
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
