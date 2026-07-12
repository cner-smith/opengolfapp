import { useState } from 'react'
import type { DetailedStats } from '@oga/core'
import { useDetailedStats } from '../../../hooks/useDetailedStats'
import { useProfile } from '../../../hooks/useProfile'
import { useUnits } from '../../../hooks/useUnits'
import {
  Lede,
  SrcBody,
  SrcLabel,
  Subkicker,
  fmtSG,
} from '../components/ArticlePrimitives'

const BRACKETS = ['PGA Tour', 'Scratch', '5', '10', '15', '20', '25+'] as const
type BracketLabel = (typeof BRACKETS)[number]

interface BenchmarkRow {
  key: string
  label: string
  values: [number, number, number, number, number, number, number]
  format: (v: number) => string
  lowerIsBetter?: boolean
  meValue?: number | null
}

export function ReadingStatsArticle() {
  const stats = useDetailedStats(10)
  const me = stats.data ?? null
  return (
    <article
      id="benchmarks"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Understanding the game · By the numbers
      </div>
      <h2
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 28,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
          marginBottom: 18,
        }}
      >
        Where you sit in the field.
      </h2>
      <BenchmarkBody me={me} />
      <Sources />
      <Footer />
    </article>
  )
}

function Footer() {
  return (
    <div
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        borderTop: '1px solid #D9D2BF',
        paddingTop: 18,
        marginTop: 22,
        lineHeight: 1.6,
      }}
    >
      Last reviewed July 2026
    </div>
  )
}

function Sources() {
  return (
    <section style={{ borderTop: '1px solid #D9D2BF', paddingTop: 18, marginTop: 22 }}>
      <div className="kicker" style={{ marginBottom: 12 }}>
        Sources
      </div>
      <div style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
        <div>
          <SrcLabel>PGA Tour benchmarks</SrcLabel>
          <SrcBody>
            Mark Broadie's "Every Shot Counts" (2014) and PGA Tour
            ShotLink-era season averages — scoring average, driving
            distance, putting make rates by distance, and approach
            proximity.
          </SrcBody>
        </div>
        <div>
          <SrcLabel>Amateur ladders</SrcLabel>
          <SrcBody>
            Shot Scope's handicap benchmark data, built from millions
            of tracked amateur shots (summarized at{' '}
            <a
              href="https://practical-golf.com/shotscope-handicap-data"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1F3D2C', textDecoration: 'underline' }}
            >
              practical-golf.com
            </a>
            ). Values are rounded and smoothed so each row steps
            consistently across brackets.
          </SrcBody>
        </div>
      </div>
    </section>
  )
}

function BenchmarkBody({ me }: { me: DetailedStats | null }) {
  const sg = me?.sg
  const ball = me?.ballStriking
  const scoring = me?.scoring
  const short = me?.shortGame
  const { toDisplay, toDisplayFt } = useUnits()

  const sgRows: BenchmarkRow[] = [
    {
      key: 'sg_off_tee',
      label: 'SG · Off the tee',
      values: [1.0, 0.0, -0.3, -0.6, -0.9, -1.2, -1.6],
      format: fmtSG,
      meValue: sg?.offTee ?? null,
    },
    {
      key: 'sg_approach',
      label: 'SG · Approach',
      values: [1.4, 0.0, -0.5, -1.1, -1.7, -2.3, -3.0],
      format: fmtSG,
      meValue: sg?.approach ?? null,
    },
    {
      key: 'sg_around',
      label: 'SG · Around the green',
      values: [0.6, 0.0, -0.3, -0.6, -0.9, -1.2, -1.5],
      format: fmtSG,
      meValue: sg?.aroundGreen ?? null,
    },
    {
      key: 'sg_putting',
      label: 'SG · Putting',
      values: [0.3, 0.0, -0.2, -0.5, -0.8, -1.1, -1.4],
      format: fmtSG,
      meValue: sg?.putting ?? null,
    },
    {
      key: 'sg_total',
      label: 'SG · Total',
      values: [3.3, 0.0, -1.3, -2.8, -4.3, -5.8, -7.5],
      format: fmtSG,
      meValue:
        sg?.offTee != null &&
        sg.approach != null &&
        sg.aroundGreen != null &&
        sg.putting != null
          ? (sg.offTee ?? 0) +
            (sg.approach ?? 0) +
            (sg.aroundGreen ?? 0) +
            (sg.putting ?? 0)
          : null,
    },
  ]

  const scoringRows: BenchmarkRow[] = [
    {
      key: 'avg_score',
      label: 'Avg score',
      values: [71.0, 72, 77, 82, 87, 92, 99],
      format: (v) => v.toFixed(1),
      lowerIsBetter: true,
      meValue: scoring?.avgScore ?? null,
    },
    {
      key: 'gir',
      label: 'GIR %',
      values: [67, 50, 40, 30, 22, 15, 9],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: ball?.girPct ?? null,
    },
    {
      key: 'fairways',
      label: 'Fairways hit',
      values: [62, 55, 50, 44, 38, 32, 26],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: ball?.fairwayPct ?? null,
    },
  ]

  const puttingRows: BenchmarkRow[] = [
    {
      key: 'putts',
      label: 'Putts / round',
      values: [29, 32, 33, 34, 35, 36, 37],
      format: (v) => v.toFixed(1),
      lowerIsBetter: true,
      meValue: short?.puttsPerRound ?? null,
    },
    {
      key: 'three_putt',
      label: '3-putt rate',
      values: [2, 5, 8, 12, 17, 22, 28],
      format: (v) => `${v.toFixed(0)}%`,
      lowerIsBetter: true,
      meValue: short?.threePuttPct ?? null,
    },
    {
      key: 'make_5ft',
      label: 'Make % from 5 ft / 152 cm',
      values: [77, 65, 58, 50, 45, 40, 35],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: null,
    },
    {
      key: 'make_10ft',
      label: 'Make % from 10 ft / 305 cm',
      values: [40, 30, 25, 20, 16, 13, 10],
      format: (v) => `${v.toFixed(0)}%`,
      meValue: null,
    },
  ]

  const ballStrikingRows: BenchmarkRow[] = [
    {
      key: 'driving',
      label: 'Driving distance',
      values: [300, 262, 255, 247, 238, 227, 212],
      format: (v) => toDisplay(v),
      meValue: ball?.drivingDistanceAvg ?? null,
    },
    {
      key: 'proximity',
      label: 'Proximity to pin (all approaches)',
      values: [37, 55, 65, 75, 88, 105, 125],
      format: (v) => toDisplayFt(v),
      lowerIsBetter: true,
      meValue: ball?.proximityAvg != null ? ball.proximityAvg * 3 : null,
    },
  ]

  const [view, setView] = useState<'chart' | 'table'>('chart')
  const profile = useProfile()
  const userBracketIndex = bracketIndexForHandicap(
    profile.data?.handicap_index ?? null,
  )

  return (
    <>
      <Lede>
        These bars show where each stat lands across the bell curve,
        from a 25-handicap weekend round all the way up to the PGA Tour.
        If you track rounds in OGA, your ten-round average appears as an
        amber dot on each scale.
      </Lede>

      <BenchmarkViewTabs value={view} onChange={setView} />

      {view === 'chart' ? (
        <>
          <BenchmarkGroup title="Strokes gained" rows={sgRows} highlightScratch />
          <BenchmarkGroup title="Scoring + ball striking" rows={scoringRows} />
          <BenchmarkGroup title="Putting" rows={puttingRows} />
          <BenchmarkGroup title="Ball striking" rows={ballStrikingRows} />
        </>
      ) : (
        <BenchmarkTable
          groups={[
            { title: 'Strokes gained', rows: sgRows, isSg: true },
            { title: 'Scoring + ball striking', rows: scoringRows },
            { title: 'Putting', rows: puttingRows },
            { title: 'Ball striking', rows: ballStrikingRows },
          ]}
          userBracketIndex={userBracketIndex}
        />
      )}
    </>
  )
}

function BenchmarkViewTabs({
  value,
  onChange,
}: {
  value: 'chart' | 'table'
  onChange: (v: 'chart' | 'table') => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #D9D2BF',
        marginTop: 14,
        marginBottom: 18,
      }}
    >
      {(['chart', 'table'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className="font-mono uppercase"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 16px',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: value === v ? '#1C211C' : '#8A8B7E',
            borderBottom:
              value === v ? '2px solid #1F3D2C' : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

interface BenchmarkGroupSpec {
  title: string
  rows: BenchmarkRow[]
  isSg?: boolean
}

function BenchmarkTable({
  groups,
  userBracketIndex,
}: {
  groups: BenchmarkGroupSpec[]
  userBracketIndex: number | null
}) {
  const headerLabels = ['25+', '20', '15', '10', '5', 'SCR', 'PGA']
  // BRACKETS goes PGA → 25+; headerLabels here is 25+ → PGA.
  const reorderIdx = [6, 5, 4, 3, 2, 1, 0]
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          minWidth: 640,
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #9F9580' }}>
            <th
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                color: '#8A8B7E',
                textAlign: 'left',
                padding: '10px 8px',
              }}
            >
              Stat
            </th>
            {headerLabels.map((h, i) => {
              const highlighted =
                userBracketIndex != null && i === userBracketIndex
              return (
                <th
                  key={h}
                  className="font-mono uppercase tabular"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: '#8A8B7E',
                    textAlign: 'right',
                    padding: '10px 8px',
                    minWidth: 56,
                    background: highlighted
                      ? 'rgba(31,61,44,0.15)'
                      : 'transparent',
                  }}
                >
                  {h}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((g) => [
            <tr key={`group-${g.title}`}>
              <td
                colSpan={8}
                className="kicker"
                style={{
                  padding: '14px 8px 6px',
                  borderTop: '1px solid #D9D2BF',
                }}
              >
                {g.title}
              </td>
            </tr>,
            ...g.rows.map((r) => (
              <tr key={r.key}>
                <td
                  className="font-serif text-caddie-ink"
                  style={{
                    padding: '10px 8px',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {r.label}
                </td>
                {reorderIdx.map((origIdx, headIdx) => {
                  const v = r.values[origIdx]!
                  const tone = g.isSg
                    ? v > 0
                      ? '#1F3D2C'
                      : v < 0
                        ? '#A33A2A'
                        : '#5C6356'
                    : '#1C211C'
                  const highlighted =
                    userBracketIndex != null && headIdx === userBracketIndex
                  return (
                    <td
                      key={origIdx}
                      className="font-serif tabular"
                      style={{
                        padding: '10px 8px',
                        fontSize: 14,
                        fontStyle: g.isSg ? 'italic' : 'normal',
                        textAlign: 'right',
                        color: tone,
                        background: highlighted
                          ? 'rgba(31,61,44,0.15)'
                          : 'transparent',
                      }}
                    >
                      {r.format(v)}
                    </td>
                  )
                })}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  )
}

function bracketIndexForHandicap(h: number | null): number | null {
  if (h == null || !Number.isFinite(h)) return null
  if (h >= 25) return 0
  if (h >= 18) return 1
  if (h >= 13) return 2
  if (h >= 8) return 3
  if (h >= 3) return 4
  return 5 // scratch
}

function BenchmarkGroup({
  title,
  rows,
  highlightScratch,
}: {
  title: string
  rows: BenchmarkRow[]
  highlightScratch?: boolean
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <Subkicker>{title}</Subkicker>
      <div className="flex flex-col" style={{ gap: 18 }}>
        {rows.map((r) => (
          <BenchmarkBar key={r.key} row={r} highlightScratch={highlightScratch} />
        ))}
      </div>
    </div>
  )
}

function BenchmarkBar({
  row,
  highlightScratch,
}: {
  row: BenchmarkRow
  highlightScratch?: boolean
}) {
  const min = Math.min(...row.values)
  const max = Math.max(...row.values)
  const project = (value: number): number => {
    if (max === min) return 50
    // x=0 = worst (left), x=100 = best (right).
    const best = row.lowerIsBetter ? min : max
    const worst = row.lowerIsBetter ? max : min
    const t = (value - worst) / (best - worst)
    return Math.max(0, Math.min(1, t)) * 100
  }

  const ordered = BRACKETS.map((bracket, i) => ({
    bracket,
    value: row.values[i]!,
    pct: project(row.values[i]!),
  })).sort((a, b) => a.pct - b.pct)

  const me = row.meValue
  const meValid = me != null && Number.isFinite(me)
  const mePct = meValid ? project(me!) : null
  const scratchValue = row.values[1]!

  return (
    <div>
      <div
        className="flex items-baseline justify-between"
        style={{ gap: 14, marginBottom: 8 }}
      >
        <span className="kicker">{row.label}</span>
        {highlightScratch && (
          <span
            className="font-serif tabular text-caddie-ink-dim"
            style={{ fontSize: 13, fontStyle: 'italic' }}
          >
            Scratch · {row.format(scratchValue)}
          </span>
        )}
      </div>
      <div
        style={{
          position: 'relative',
          height: 36,
          background:
            'linear-gradient(to right, #FBF8F1 0%, #EBE5D6 50%, #1F3D2C 100%)',
          border: '1px solid #D9D2BF',
          borderRadius: 2,
        }}
      >
        {ordered.map((b) => (
          <div
            key={b.bracket}
            style={{
              position: 'absolute',
              left: `${b.pct}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'rgba(28,33,28,0.35)',
            }}
          />
        ))}
        {mePct != null && (
          <div
            title={`You · ${row.format(me!)}`}
            style={{
              position: 'absolute',
              left: `calc(${mePct}% - 7px)`,
              top: 'calc(50% - 7px)',
              width: 14,
              height: 14,
              borderRadius: 999,
              background: '#A66A1F',
              border: '2px solid #FBF8F1',
            }}
          />
        )}
      </div>
      <div
        className="font-mono uppercase tabular text-caddie-ink-mute"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          marginTop: 4,
          position: 'relative',
          height: 14,
        }}
      >
        {ordered.map((b) => (
          <span
            key={b.bracket}
            style={{
              position: 'absolute',
              left: `${b.pct}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {labelForBracket(b.bracket)}
          </span>
        ))}
      </div>
      <div
        className="flex items-baseline justify-between"
        style={{ marginTop: 18 }}
      >
        <span className="text-caddie-ink-mute" style={{ fontSize: 11 }}>
          25+ HCP{' '}
          <span className="font-serif tabular" style={{ fontStyle: 'italic' }}>
            {row.format(row.values[6]!)}
          </span>
        </span>
        <span className="text-caddie-ink-mute" style={{ fontSize: 11 }}>
          PGA Tour{' '}
          <span className="font-serif tabular" style={{ fontStyle: 'italic' }}>
            {row.format(row.values[0]!)}
          </span>
        </span>
      </div>
      {mePct != null && (
        <div
          className="text-caddie-warn"
          style={{ fontSize: 12, marginTop: 6, fontWeight: 500 }}
        >
          You ·{' '}
          <span className="font-serif tabular" style={{ fontStyle: 'italic' }}>
            {row.format(me!)}
          </span>
        </div>
      )}
    </div>
  )
}

function labelForBracket(b: BracketLabel): string {
  if (b === 'PGA Tour') return 'PGA'
  if (b === 'Scratch') return 'SCR'
  return b
}
