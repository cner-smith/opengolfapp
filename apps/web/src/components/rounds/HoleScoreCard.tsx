import { useEffect, useRef, useState } from 'react'
import type { Database } from '@oga/supabase'
import { useUpsertHoleScore } from '../../hooks/useHoleScores'
import { useUnits } from '../../hooks/useUnits'
import { toUserMessage } from '../../lib/errors'
import { GolfMark, GRAPHITE, PencilTick } from '../../pages/rounds/components/PencilMarks'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

// "Your card" columns (mobile HoleTable COL widths on a phone, roomier from
// sm up): Hole · Par · Score · Putts · Fwy · Green · Shots. Shared with the
// header row in ScorecardView.
export const CARD_COLS =
  'grid grid-cols-[34px_34px_56px_44px_36px_46px_1fr] sm:grid-cols-[64px_56px_88px_68px_64px_64px_1fr]'

interface HoleScoreCardProps {
  roundId: string
  hole: HoleRow
  holeScore?: HoleScoreRow
  shotCount: number
  /** Tee-resolved par/yards for this hole (hole_tees override for the
   *  round's selected tee, if any, over the base `holes` row — the
   *  per-round hole_scores.par override is already folded in). Prefer
   *  these over hole.par/hole.yards. */
  resolvedPar: number
  resolvedYards: number | null
  /** Materialize a synthetic-id hole into a real `holes` row before
   *  the hole_scores upsert (FK requirement). No-op for real holes. */
  ensureRealHole: (hole: HoleRow) => Promise<string>
  onEditShots: (holeScoreId: string) => void
}


const PENCIL_INPUT =
  'border-0 border-b border-solid border-transparent placeholder:text-caddie-line-strong focus:border-caddie-line-strong focus:outline-none'

// Fairway / green: a pencil tick when hit, a dot when missed, a dash when not
// set. Clicking cycles hit → missed → not set.
function TickCell({
  state,
  onChange,
  label,
  seed,
}: {
  state: boolean | null
  onChange: (v: boolean | null) => void
  label: string
  seed: number
}) {
  const word = state === true ? 'hit' : state === false ? 'missed' : 'not set'
  return (
    <button
      type="button"
      onClick={() => onChange(state === true ? false : state === false ? null : true)}
      aria-label={`${label}: ${word}`}
      title="Click: hit · missed · not set"
      className="mx-auto flex items-center justify-center hover:outline hover:outline-1 hover:outline-caddie-line-strong focus-visible:outline focus-visible:outline-1 focus-visible:outline-caddie-ink"
      style={{ width: 34, height: 34, borderRadius: 2, background: 'transparent', border: 'none' }}
    >
      {state === true ? (
        <PencilTick seed={seed} />
      ) : (
        <span style={{ fontSize: 15, color: 'rgba(28,33,28,.35)' }}>{state === false ? '·' : '—'}</span>
      )}
    </button>
  )
}

export function HoleScoreCard({
  roundId,
  hole,
  holeScore,
  shotCount,
  resolvedPar,
  resolvedYards,
  ensureRealHole,
  onEditShots,
}: HoleScoreCardProps) {
  const upsert = useUpsertHoleScore(roundId)
  const { toDisplay } = useUnits()
  // A 0 score is an unplayed hole (live rounds seed rows ahead of play).
  const [score, setScore] = useState<string>(holeScore?.score ? String(holeScore.score) : '')
  const [putts, setPutts] = useState<string>(holeScore?.putts?.toString() ?? '')
  const [fairway, setFairway] = useState<boolean | null>(holeScore?.fairway_hit ?? null)
  const [gir, setGir] = useState<boolean | null>(holeScore?.gir ?? null)
  // Par is always editable on the scorecard — synthetic-fallback courses
  // need it (par-4 default is wrong for the par 3s and 5s) and real
  // courses occasionally have stale data the player wants to correct.
  // Persisted as hole_scores.par (per-round override, #710); resolvedPar
  // (tee-override-aware, with the round override already folded in) is
  // the fallback ahead of any local optimistic edit.
  const [parOverride, setParOverride] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const effectivePar = parOverride ?? resolvedPar

  // Hydrate the form from server state once per holeScore.id. Subsequent
  // refetches (after our own save, or another tab) must not clobber what
  // the user is typing — that was the source of "I edited and it reverted"
  // reports during scorecard entry.
  const hydratedIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!holeScore) return
    if (hydratedIdRef.current === holeScore.id) return
    hydratedIdRef.current = holeScore.id
    setScore(holeScore.score ? String(holeScore.score) : '')
    setPutts(holeScore.putts?.toString() ?? '')
    setFairway(holeScore.fairway_hit ?? null)
    setGir(holeScore.gir ?? null)
  }, [holeScore])

  // Cycle par 3 → 4 → 5 → 3. Par is a per-round override on
  // hole_scores.par (#710) — this round's opinion, not global course
  // curation (holes has no UPDATE policy; the old direct update silently
  // no-op'd). With no score yet there's no hole_scores row to hold it
  // (score is NOT NULL), so the override stays local and persist()
  // carries it with the first score save.
  async function setPar(newPar: number) {
    setParOverride(newPar)
    const existingScore = holeScore?.score ?? (score ? Number(score) : null)
    if (!existingScore) return
    setSaveError(null)
    try {
      const realHoleId = await ensureRealHole({ ...hole, par: newPar })
      await upsert.mutateAsync({
        id: holeScore?.id,
        round_id: roundId,
        hole_id: realHoleId,
        score: existingScore,
        par: newPar,
      })
    } catch (err) {
      // Roll back the optimistic override so the UI doesn't lie about
      // what's persisted. The user re-tries by tapping again.
      setParOverride(null)
      setSaveError(toUserMessage(err))
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[HoleScoreCard/setPar]', err)
      }
    }
  }

  async function persist(next: {
    score?: number | null
    putts?: number | null
    fairway_hit?: boolean | null
    gir?: boolean | null
  }) {
    const numericScore =
      next.score !== undefined ? next.score : score ? Number(score) : null
    if (!numericScore) return
    // Materialize the synthetic hole before the upsert (FK on hole_id).
    // Pass the par override so the new holes row reflects the user's
    // pick rather than the par-4 placeholder default.
    const holeForEnsure =
      parOverride != null ? { ...hole, par: parOverride } : hole
    // ensureRealHole can reject and the upsert can fail (network/RLS). Both
    // were fire-and-forget: the typed value stayed on screen with nothing
    // saved and no signal, so the round silently "lost" holes (#664).
    setSaveError(null)
    try {
      const realHoleId = await ensureRealHole(holeForEnsure)
      await upsert.mutateAsync({
        id: holeScore?.id,
        round_id: roundId,
        hole_id: realHoleId,
        score: numericScore,
        // Carry a locally-held par override (tapped before any score
        // existed) so it lands with the row's first save.
        par: parOverride ?? undefined,
        putts:
          next.putts !== undefined
            ? next.putts
            : putts === ''
              ? null
              : Number(putts),
        fairway_hit:
          effectivePar <= 3
            ? null
            : next.fairway_hit !== undefined
              ? next.fairway_hit
              : fairway,
        gir: next.gir !== undefined ? next.gir : gir,
      })
    } catch (err) {
      setSaveError(toUserMessage(err))
    }
  }

  const isPar3 = effectivePar === 3
  const typed = score ? Number(score) : 0

  // The figures are pencilled in (Kalam graphite), as on the phone's card;
  // no input boxes at rest, a 1px underline while focused.
  const pencil = (size: number) =>
    ({
      fontFamily: 'Kalam, cursive',
      fontSize: size,
      lineHeight: 1,
      color: GRAPHITE,
      background: 'transparent',
      borderRadius: 0,
      textAlign: 'center',
      width: '100%',
      padding: '6px 0 2px',
      position: 'relative',
    }) as const

  return (
    <div style={{ borderBottom: '1px solid #D9D2BF' }}>
      <div className={`${CARD_COLS} items-center`} style={{ minHeight: 52 }}>
        <div>
          <div className="text-caddie-ink tabular" style={{ fontSize: 15 }}>
            {hole.number}
          </div>
          {resolvedYards != null && resolvedYards > 0 && (
            <div className="hidden sm:block text-caddie-ink-dim tabular" style={{ fontSize: 12 }}>
              {toDisplay(resolvedYards).toLowerCase()}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            const next = effectivePar === 3 ? 4 : effectivePar === 4 ? 5 : 3
            void setPar(next)
          }}
          aria-label={`Hole ${hole.number} par ${effectivePar}, click to change`}
          title="Click to change par"
          className="mx-auto text-caddie-ink tabular hover:underline"
          style={{
            fontSize: 15,
            background: 'transparent',
            border: 'none',
            padding: '8px 6px',
            textUnderlineOffset: 4,
            textDecorationColor: '#9F9580',
          }}
        >
          {effectivePar}
        </button>

        <div className="relative flex items-center justify-center" style={{ height: 52 }}>
          {typed > 0 && <GolfMark toPar={typed - effectivePar} seed={hole.number} />}
          <input
            type="text"
            inputMode="numeric"
            placeholder="—"
            aria-label={`Hole ${hole.number} score`}
            value={score}
            onChange={(e) => setScore(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => {
              const n = score ? Number(score) : null
              if (n) void persist({ score: n })
            }}
            className={PENCIL_INPUT}
            style={pencil(28)}
          />
        </div>

        <input
          type="text"
          inputMode="numeric"
          placeholder="—"
          aria-label={`Hole ${hole.number} putts`}
          value={putts}
          onChange={(e) => setPutts(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => void persist({ putts: putts === '' ? null : Number(putts) })}
          className={PENCIL_INPUT}
          style={pencil(22)}
        />

        {isPar3 ? (
          <span role="img" aria-label="No fairway on a par 3" />
        ) : (
          <TickCell
            label={`Hole ${hole.number} fairway`}
            seed={hole.number * 2}
            state={fairway}
            onChange={(v) => {
              setFairway(v)
              void persist({ fairway_hit: v })
            }}
          />
        )}

        <TickCell
          label={`Hole ${hole.number} green`}
          seed={hole.number * 2 + 1}
          state={gir}
          onChange={(v) => {
            setGir(v)
            void persist({ gir: v })
          }}
        />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!holeScore}
            onClick={() => holeScore && onEditShots(holeScore.id)}
            className="key"
            style={{ minHeight: 34, padding: '0 10px', fontSize: 13, gap: 4 }}
            aria-label={
              holeScore
                ? `Hole ${hole.number}, ${shotCount} shot${shotCount === 1 ? '' : 's'}, edit`
                : 'Enter a score to log shots'
            }
            title={holeScore ? 'Edit shots' : 'Enter a score to log shots'}
          >
            <span className="hidden sm:inline">
              {shotCount > 0 ? `${shotCount} shots` : 'Add shots'}
            </span>
            <span className="sm:hidden">Shots</span>
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>›</span>
          </button>
        </div>
      </div>
      {saveError && (
        <div className="text-caddie-neg" style={{ fontSize: 13, paddingBottom: 8 }}>
          {saveError}
        </div>
      )}
    </div>
  )
}
