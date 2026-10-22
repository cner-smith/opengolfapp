import { useEffect, useMemo, useState } from 'react'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Link } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import {
  isPartialRound,
  normalizeCategoryProse,
  sgBreakdown,
  parseLocalDate,
  sgFinding,
  shouldPromptPlanRefresh,
  todayLocalDate,
} from '@oga/core'
import type { BlockType, StoredBlock, StoredFocusArea, StoredSession } from '@oga/core'
import { AppBar } from '../../components/ui/AppBar'
import { Entrance } from '../../components/ui/Entrance'
import { PressableTouch } from '../../components/ui/PressableTouch'
import {
  BLOCK_TYPE_LABEL,
  CATEGORY_LABEL,
  FACILITY_LABEL,
  MODE_COLOR,
  renderInstructions,
} from '../../components/practice/drillDisplay'
import { getRecentRounds } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { haptic } from '../../lib/haptics'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { PaperTile, SectionHead } from '../../components/paper/Section'
import { FONT_CAP, P } from '../../components/paper/tokens'
import { usePracticePlan, type DrillCard as DrillRow } from '../../hooks/usePracticePlan'

const INK = P.ink
const INK_DIM = P.inkDim
const INK_MUTE = '#8A8B7E'
const LINE = P.line
const ACCENT = P.forest
const CREAM = P.chrome
const NEG = P.neg

// Small sentence-case meta line (dates, counters, sources).
const META: import('react-native').TextStyle = { ...TYPE.body, color: INK_DIM, fontSize: 12 }

const FEEDBACK_MAX = 500

// plan.drills is jsonb `{ sessions: StoredSession[] }`; focus_areas is
// jsonb StoredFocusArea[]. Mirror web's asDrills/asFocusAreas guards.
function asSessions(value: unknown): StoredSession[] {
  if (value && typeof value === 'object' && Array.isArray((value as { sessions?: unknown }).sessions)) {
    return (value as { sessions: StoredSession[] }).sessions
  }
  return []
}
function asFocusAreas(value: unknown): StoredFocusArea[] {
  return Array.isArray(value) ? (value as StoredFocusArea[]) : []
}

// `valid_until` / `generated_at` are bare date strings (YYYY-MM-DD), compared
// to today's *local* date so a plan stays current through its final day.
function formatDate(value: string | null): string {
  if (!value) return ''
  const parsed = parseLocalDate(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const SG_KEYS = [
  { key: 'sg_off_tee', label: 'Off the tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around the green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

// Home's finding over the same window (the 20 most recent whole rounds), so
// the plan opens on the leak it was built for; null with no whole rounds.
function useFinding(): string | null {
  const { user } = useAuth()
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    let active = true
    getRecentRounds(supabase, user.id, 40).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[practice/getRecentRounds]', error.message)
        return
      }
      const whole = (data ?? []).filter((r) => !isPartialRound(r.hole_scores)).slice(0, 20)
      if (whole.length === 0) return setText(null)
      const { breakdown } = sgBreakdown(whole)
      const avgs = SG_KEYS.map((c) => ({ label: c.label, value: breakdown.find((b) => b.key === c.key)?.value ?? 0 }))
      const sorted = [...avgs].sort((a, b) => b.value - a.value)
      setText(sgFinding(sorted[sorted.length - 1]!, sorted[0]!, 'every part'))
    })
    return () => {
      active = false
    }
  }, [user])
  return text
}

export default function Practice() {
  const finding = useFinding()
  const {
    plan,
    drillsById,
    loading,
    generating,
    error,
    roundsWithSG,
    loadDrills,
    generate,
    toggleCompletion,
    submitFeedback,
  } = usePracticePlan()

  // Key on plan.drills, not plan: a completion toggle replaces the plan object
  // but leaves drills untouched, so this keeps a stable identity and avoids a
  // redundant getDrillsByIds refetch (via drillIds) on every checkbox tap.
  const sessions = useMemo(() => asSessions(plan?.drills), [plan?.drills])
  const focusAreas = useMemo(() => asFocusAreas(plan?.focus_areas), [plan])
  const drillIds = useMemo(
    () =>
      sessions.flatMap((s) =>
        s.blocks.map((b) => b.drill_id).filter((id): id is string => id !== undefined),
      ),
    [sessions],
  )
  // Resolve the plan's drill rows once the plan (and its ids) are known.
  useEffect(() => {
    loadDrills(drillIds)
  }, [loadDrills, drillIds])

  const completed = new Set(plan?.completed_drill_ids ?? [])

  // No-regenerate-within-window: only offer Generate once the plan's date passed,
  // or (#1056) right after the 2nd/3rd round when the plan hasn't seen them.
  const isExpired = !!plan?.valid_until && plan.valid_until < todayLocalDate()
  const isStarter = !!plan && !plan.based_on_rounds
  const promptRefresh =
    !!plan &&
    roundsWithSG != null &&
    shouldPromptPlanRefresh({ planRounds: plan.based_on_rounds, roundsNow: roundsWithSG })
  const generateLabel = promptRefresh
    ? 'Update your plan with your rounds'
    : isExpired
      ? 'Generate this week’s plan'
      : null
  const sub = !plan
    ? ''
    : isExpired
      ? `Last week's plan, through ${formatDate(plan.valid_until)}`
      : `Week of ${formatDate(plan.generated_at)}${plan.valid_until ? `, through ${formatDate(plan.valid_until)}` : ''}${isStarter ? ' · starter plan' : ''}`

  return (
    <PaperSurface style={{ flex: 1,  }}>
      <AppBar
        title="Practice"
        right={
          <Link href={'/(app)/learn' as never} asChild>
            <PressableTouch
              accessibilityRole="button"
              accessibilityLabel="Learn articles"
              // Extend the touch target to the ~44pt minimum without bloating
              // the compact chip's visual height (padding stays 6).
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingVertical: 6,
                paddingHorizontal: 11,
                borderWidth: 1,
                borderColor: 'rgba(242,238,229,0.25)',
                borderRadius: 2,
              }}
            >
              <MaterialCommunityIcons name="book-open-variant" size={14} color={CREAM} />
              <Text style={[TYPE.bodyBold, { color: CREAM, fontSize: 12, letterSpacing: 0.3 }]}>
                Learn
              </Text>
            </PressableTouch>
          </Link>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        {loading ? (
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : !plan ? (
          <NoPlan finding={finding} generating={generating} error={error} onGenerate={generate} />
        ) : (
          <>
            <Entrance index={0}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, fontSize: 13, marginBottom: 8 }}>{sub}</Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: INK, fontSize: 22, lineHeight: 28, marginBottom: 18 }]}>
              {finding ?? plan.ai_insight ?? 'Your practice plan'}
            </Text>

            <WeekBar sessions={sessions} completed={completed} />

            {/* Regenerate affordance: once the plan has expired, or the
                post-round "update your plan" prompt. */}
            {generateLabel ? (
              <Key
                tone="primary"
                accessibilityLabel={generateLabel}
                disabled={generating}
                onPress={generate}
                style={{ marginBottom: 22 }}
                faceStyle={{ minHeight: 48 }}
              >
                {generating ? (
                  <ActivityIndicator color={INK} />
                ) : (
                  <KeyText tone="primary" bold size={15}>
                    {generateLabel}
                  </KeyText>
                )}
              </Key>
            ) : null}

            {error ? (
              <Text style={[TYPE.body, { color: NEG, fontSize: 13, marginBottom: 14 }]}>{error}</Text>
            ) : null}
            </Entrance>

            <Entrance index={1}>
            {sessions.map((session, i) => (
              <SessionBlock
                key={`session-${i}`}
                session={session}
                drillsById={drillsById}
                completed={completed}
                onToggle={toggleCompletion}
              />
            ))}
            </Entrance>

            <Entrance index={2}>
              <WhyThisPlan
                insight={finding ? plan.ai_insight : null}
                note={plan.coach_note}
                basis={
                  isStarter
                    ? 'Built from your profile answers, not your rounds yet.'
                    : `Built from your last ${plan.based_on_rounds} round${plan.based_on_rounds === 1 ? '' : 's'}.`
                }
              />
              {focusAreas.length > 0 ? <FocusAreas areas={focusAreas} /> : null}
            </Entrance>

            <Entrance index={3}>
            {plan.id ? (
              <FeedbackSection key={plan.id} initial={plan.feedback ?? ''} onSave={submitFeedback} />
            ) : null}

            <Link href={'/(app)/drills' as never} asChild>
              <PressableTouch accessibilityRole="link" hitSlop={6} style={{ paddingVertical: 8 }}>
                <Text style={[TYPE.bodyBold, { color: ACCENT, fontSize: 15 }]}>Browse all drills →</Text>
              </PressableTouch>
            </Link>
            </Entrance>
          </>
        )}
      </ScrollView>
    </PaperSurface>
  )
}

function NoPlan({
  finding,
  generating,
  error,
  onGenerate,
}: {
  finding: string | null
  generating: boolean
  error: string | null
  onGenerate: () => void
}) {
  return (
    <View>
      {finding ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: INK, fontSize: 22, lineHeight: 28, marginBottom: 18 }]}>
          {finding}
        </Text>
      ) : null}
      <Text
        style={[TYPE.serif, {
          color: INK,
          fontSize: 20,
          lineHeight: 26,
          marginBottom: 8,
        }]}
      >
        A week built from your own numbers.
      </Text>
      <Text style={[TYPE.body, { color: INK_DIM, fontSize: 14, lineHeight: 20, marginBottom: 22 }]}>
        Sessions sized to your strokes gained and the places you practice: which drills, in what order, and why
        each one is there.
      </Text>

      <Key
        tone="primary"
        accessibilityLabel="Generate this week's plan"
        disabled={generating}
        onPress={onGenerate}
        faceStyle={{ minHeight: 52 }}
      >
        {generating ? (
          <ActivityIndicator color={INK} />
        ) : (
          <KeyText tone="primary" bold size={16}>
            Generate this week’s plan
          </KeyText>
        )}
      </Key>
      {generating ? (
        <Text style={[TYPE.body, { color: INK_MUTE, fontSize: 12, textAlign: 'center', marginTop: 10 }]}>
          Reading your rounds and writing the plan… this takes a few seconds.
        </Text>
      ) : null}
      {error ? (
        <Text style={[TYPE.body, { color: NEG, fontSize: 13, marginTop: 12 }]}>{error}</Text>
      ) : null}

      <View style={{ marginTop: 28, borderTopWidth: 1, borderColor: LINE, paddingTop: 18 }}>
        <Link href={'/(app)/drills' as never} asChild>
          <Pressable>
            <Text style={[TYPE.serif, { color: ACCENT, fontSize: 17 }]}>
              Browse all drills →
            </Text>
          </Pressable>
        </Link>
        <Link href={'/(app)/learn' as never} asChild>
          <Pressable style={{ marginTop: 10 }}>
            <Text style={[TYPE.serif, { color: ACCENT, fontSize: 17 }]}>
              Learn the stats →
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  )
}

function WhyThisPlan({ insight, note, basis }: { insight: string | null; note: string | null; basis: string }) {
  return (
    <View style={{ marginTop: 8, marginBottom: 24 }}>
      <SectionHead title="Why this plan" />
      {insight ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: INK, fontSize: 17, lineHeight: 24, marginBottom: 8 }]}>
          {insight}
        </Text>
      ) : null}
      {note ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: INK_DIM, fontSize: 14, lineHeight: 21 }]}>
          {normalizeCategoryProse(note)}
        </Text>
      ) : null}
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, color: INK_MUTE, marginTop: 8 }}>
        {basis}
      </Text>
    </View>
  )
}

// Sessions done of planned and minutes done of planned: one segment per session,
// sized by its minutes and filled by the minutes ticked off.
function WeekBar({ sessions, completed }: { sessions: StoredSession[]; completed: Set<string> }) {
  const rows = sessions.map((s) => {
    const blocks = s.blocks ?? []
    return {
      title: s.title,
      total: blocks.reduce((m, b) => m + b.minutes, 0),
      done: blocks.filter((b) => completed.has(b.id)).reduce((m, b) => m + b.minutes, 0),
      complete: blocks.length > 0 && blocks.every((b) => completed.has(b.id)),
    }
  })
  if (rows.length === 0) return null
  const totalMin = rows.reduce((m, r) => m + r.total, 0)
  const doneMin = rows.reduce((m, r) => m + r.done, 0)
  const doneSessions = rows.filter((r) => r.complete).length
  return (
    <View style={{ marginBottom: 24 }} accessible accessibilityLabel={`${doneSessions} of ${rows.length} sessions done, ${doneMin} of ${totalMin} minutes`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: INK, fontSize: 14 }]}>
          <Text style={[TYPE.serifUpright, { fontSize: 20 }]}>{doneSessions}</Text> of {rows.length} session{rows.length === 1 ? '' : 's'} done this week
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: INK_DIM, fontSize: 13 }]}>
          <Text style={[TYPE.serifUpright, { color: INK, fontSize: 16 }]}>{doneMin}</Text> of {totalMin} min
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 3, height: 12 }}>
        {rows.map((r, i) => (
          <View key={i} style={{ flex: r.total || 1, backgroundColor: P.well, borderRadius: 1, overflow: 'hidden' }}>
            <FillBar pct={r.total ? r.done / r.total : 0} />
          </View>
        ))}
      </View>
    </View>
  )
}

function FillBar({ pct }: { pct: number }) {
  const reduce = useReducedMotion()
  const w = useSharedValue(pct)
  useEffect(() => {
    w.value = reduce ? pct : withTiming(pct, { duration: 420 })
  }, [pct, w, reduce])
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }))
  return <Animated.View style={[{ height: '100%', backgroundColor: ACCENT }, style]} />
}

const MODE_ORDER: BlockType[] = ['warmup', 'blocked', 'random', 'skill_game', 'pressure_game', 'on_course']

// A session's minutes by practice mode as one stacked bar, the modes named under it.
function ModeBar({ parts }: { parts: { type: BlockType; minutes: number }[] }) {
  const byMode = new Map<BlockType, number>()
  for (const p of parts) byMode.set(p.type, (byMode.get(p.type) ?? 0) + p.minutes)
  const modes = MODE_ORDER.filter((m) => (byMode.get(m) ?? 0) > 0)
  if (modes.length === 0) return null
  return (
    <View accessible accessibilityLabel={modes.map((m) => `${BLOCK_TYPE_LABEL[m]} ${byMode.get(m)} minutes`).join(', ')}>
      <View style={{ flexDirection: 'row', height: 10, gap: 2 }}>
        {modes.map((m) => (
          <View key={m} style={{ flex: byMode.get(m)!, backgroundColor: MODE_COLOR[m], borderRadius: 1 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 8 }}>
        {modes.map((m) => (
          <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, backgroundColor: MODE_COLOR[m], borderRadius: 1 }} />
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: INK_DIM, fontSize: 12 }]}>
              {BLOCK_TYPE_LABEL[m]} <Text style={[TYPE.serifUpright, { color: INK }]}>{byMode.get(m)}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function SessionBlock({
  session,
  drillsById,
  completed,
  onToggle,
}: {
  session: StoredSession
  drillsById: Record<string, DrillRow>
  completed: Set<string>
  onToggle: (blockId: string) => void
}) {
  const blocks = [...(session.blocks ?? [])].sort((a, b) => a.order - b.order)
  const doneCount = blocks.filter((b) => completed.has(b.id)).length
  const allDone = blocks.length > 0 && doneCount === blocks.length
  return (
    <PaperTile style={{ marginBottom: 22 }} innerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 4, borderColor: allDone ? ACCENT : P.ink }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: INK, fontSize: 20, lineHeight: 25, flex: 1 }]}>
          {session.title}
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[allDone ? TYPE.bodyBold : TYPE.body, { color: allDone ? ACCENT : INK_DIM, fontSize: 13 }]}>
          {allDone ? 'Done' : doneCount > 0 ? `${doneCount} of ${blocks.length} done` : `${session.total_minutes} min`}
        </Text>
      </View>
      <View style={{ marginBottom: 12 }}>
        <ModeBar parts={blocks} />
      </View>
      {blocks.map((block, i) => (
        <DrillRowItem
          key={block.id ?? `${block.drill_id}-${i}`}
          block={block}
          drill={block.drill_id ? drillsById[block.drill_id] : undefined}
          completed={completed.has(block.id)}
          onToggle={() => onToggle(block.id)}
        />
      ))}
    </PaperTile>
  )
}

// The tick: the box pops past full size and settles, with a light haptic.
function TickBox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  const reduce = useReducedMotion()
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <PressableTouch
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        if (!checked) {
          if (!reduce) scale.value = withSequence(withTiming(0.75, { duration: 70 }), withSpring(1, { damping: 7, stiffness: 320 }))
          haptic('toggleOn')
        } else {
          haptic('toggleOff')
        }
        onPress()
      }}
    >
      <Animated.View
        style={[
          {
            width: 24,
            height: 24,
            borderRadius: 2,
            marginTop: 1,
            borderWidth: 1,
            borderColor: checked ? ACCENT : P.lineStrong,
            backgroundColor: checked ? ACCENT : P.raised,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        {checked ? <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: CREAM, fontSize: 14, lineHeight: 16 }]}>✓</Text> : null}
      </Animated.View>
    </PressableTouch>
  )
}

function DrillRowItem({
  block,
  drill,
  completed,
  onToggle,
}: {
  block: StoredBlock
  drill: DrillRow | undefined
  completed: boolean
  onToggle: () => void
}) {
  const [open, setOpen] = useState(false)
  const name = drill?.name ?? 'Drill'
  const facilities = drill?.facility ?? []
  const instructions = drill?.instructions?.trim() || drill?.description?.trim() || ''
  const canExpand = instructions.length > 0
  const meta = [BLOCK_TYPE_LABEL[block.type] ?? block.type, ...facilities.map((f) => FACILITY_LABEL[f] ?? f)].join(' · ')
  return (
    <View style={{ borderTopWidth: 1, borderColor: LINE, paddingVertical: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TickBox checked={completed} label={`Mark ${name} done`} onPress={onToggle} />
        {/* Everything but the box opens the how-to. */}
        <PressableTouch
          onPress={() => canExpand && setOpen((o) => !o)}
          disabled={!canExpand}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${name}${canExpand ? `, tap to ${open ? 'close' : 'read how'}` : ''}`}
          style={{ flex: 1 }}
        >
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Text
              maxFontSizeMultiplier={FONT_CAP}
              style={[TYPE.serif, {
                color: completed ? INK_MUTE : INK,
                fontSize: 18,
                lineHeight: 23,
                flex: 1,
                textDecorationLine: completed ? 'line-through' : 'none',
              }]}
            >
              {name}
            </Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: INK, fontSize: 19, lineHeight: 23 }]}>
              {block.minutes}
              <Text style={[TYPE.body, { color: INK_DIM, fontSize: 12 }]}> min</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{ width: 8, height: 8, backgroundColor: MODE_COLOR[block.type], borderRadius: 1 }} />
            <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, flex: 1 }}>
              {meta}
              {block.target != null ? ` · target ${block.target}` : ''}
            </Text>
          </View>
          {block.rationale && !completed ? (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: INK_DIM, fontSize: 13, lineHeight: 19, marginTop: 6 }]}>
              {block.rationale}
            </Text>
          ) : null}
          {canExpand ? (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: INK_DIM, fontSize: 13, marginTop: 6, textDecorationLine: 'underline' }]}>
              {open ? 'Hide how to run it' : 'How to run it'}
            </Text>
          ) : null}
        </PressableTouch>
      </View>

      {open && canExpand ? (
        <View style={{ marginTop: 12, marginLeft: 36, paddingLeft: 12, borderLeftWidth: 2, borderColor: LINE }}>
          {renderInstructions(instructions)}
          {drill?.source ? (
            <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, fontSize: 11, marginTop: 12 }}>
              From {drill.source}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function FocusAreas({ areas }: { areas: StoredFocusArea[] }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHead title="What to work on" />
      {areas.map((a, i) => (
        <View key={`focus-${i}`} style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: LINE, paddingVertical: 10 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: INK, fontSize: 15 }]}>
            {CATEGORY_LABEL[a.category] ?? a.category}
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: INK_DIM, fontSize: 13, lineHeight: 19, marginTop: 2 }]}>
            {normalizeCategoryProse(a.reason)}
          </Text>
          {a.article ? (
            <Link href={{ pathname: '/(app)/learn/[article]', params: { article: a.article.slug } }} asChild>
              <PressableTouch accessibilityRole="link" hitSlop={6} style={{ marginTop: 6 }}>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: ACCENT, fontSize: 13 }]}>
                  Read: {a.article.title}
                </Text>
              </PressableTouch>
            </Link>
          ) : null}
        </View>
      ))}
    </View>
  )
}

function FeedbackSection({
  initial,
  onSave,
}: {
  initial: string
  onSave: (feedback: string) => Promise<void> | void
}) {
  const [value, setValue] = useState(initial)
  // Track the last persisted value so blur only saves real edits and the
  // "Saved" indicator clears the moment the user edits again.
  const [savedValue, setSavedValue] = useState(initial)
  const [saving, setSaving] = useState(false)

  const handleBlur = async () => {
    const next = value.trim()
    if (next === savedValue.trim()) return
    if (next.length === 0 && savedValue.trim().length === 0) return
    setSaving(true)
    await onSave(next)
    setSavedValue(next)
    setSaving(false)
  }

  const showSaved = !saving && value.trim() === savedValue.trim() && savedValue.trim().length > 0

  return (
    <View style={{ marginBottom: 28 }}>
      <SectionHead title="Before next week" />
      <Text style={[TYPE.body, { color: INK_DIM, fontSize: 14, lineHeight: 20, marginBottom: 12 }]}>
        One note on how the week went: what worked, what felt off. Next week’s plan reads it.
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        onBlur={handleBlur}
        maxLength={FEEDBACK_MAX}
        multiline
        textAlignVertical="top"
        placeholder="What worked, what felt off…"
        placeholderTextColor={INK_MUTE}
        style={[TYPE.body, {
          minHeight: 92,
          color: INK,
          backgroundColor: P.raised,
          borderWidth: 1,
          borderColor: INK,
          borderRadius: 3,
          padding: 12,
          fontSize: 15,
          lineHeight: 21,
        }]}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, fontSize: 11 }}>{saving ? 'Saving…' : showSaved ? 'Saved' : ''}</Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, fontSize: 11 }}>
          {value.length} / {FEEDBACK_MAX}
        </Text>
      </View>
    </View>
  )
}
