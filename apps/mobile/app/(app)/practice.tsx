import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import type { StoredFocusArea, StoredSession } from '@oga/core'
import { AppBar } from '../../components/ui/AppBar'
import { PressableTouch } from '../../components/ui/PressableTouch'
import { TYPE } from '../../lib/typography'
import { usePracticePlan, type DrillCard as DrillRow } from '../../hooks/usePracticePlan'

const INK = '#1C211C'
const INK_DIM = '#5C6356'
const INK_MUTE = '#8A8B7E'
const LINE = '#D9D2BF'
const ACCENT = '#1F3D2C'
const CREAM = '#F2EEE5'

const KICKER: import('react-native').TextStyle = {
  ...TYPE.kicker,
  color: INK_MUTE,
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

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

export default function Practice() {
  const { plan, drillsById, loading, generating, error, loadDrills, generate, toggleCompletion } =
    usePracticePlan()

  const sessions = useMemo(() => asSessions(plan?.drills), [plan])
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

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <AppBar eyebrow="Today's focus" title="Practice" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        {loading ? (
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : !plan ? (
          <NoPlan generating={generating} error={error} onGenerate={generate} />
        ) : (
          <>
            <Text style={{ ...KICKER, marginBottom: 8 }}>
              Practice plan{plan.based_on_rounds ? ` · ${plan.based_on_rounds} rounds` : ''}
            </Text>
            <Text
              style={[TYPE.serif, {
                color: INK,
                fontSize: 26,
                fontStyle: 'italic',
                fontWeight: '500',
                lineHeight: 31,
                marginBottom: 18,
              }]}
            >
              {plan.ai_insight ?? 'Your practice plan'}
            </Text>

            {error ? (
              <Text style={[TYPE.body, { color: '#A33A2A', fontSize: 13, marginBottom: 14 }]}>
                {error}
              </Text>
            ) : null}

            {plan.coach_note ? <ReasoningPanel note={plan.coach_note} /> : null}

            {focusAreas.length > 0 ? <FocusAreas areas={focusAreas} /> : null}

            {sessions.map((session, i) => (
              <SessionBlock
                key={`session-${i}`}
                session={session}
                sessionNumber={i + 1}
                drillsById={drillsById}
                completed={completed}
                onToggle={toggleCompletion}
              />
            ))}

            {plan.based_on_rounds ? (
              <Text style={{ ...KICKER, paddingTop: 4 }}>
                Based on your last {plan.based_on_rounds} round
                {plan.based_on_rounds === 1 ? '' : 's'}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function NoPlan({
  generating,
  error,
  onGenerate,
}: {
  generating: boolean
  error: string | null
  onGenerate: () => void
}) {
  return (
    <View>
      <Text
        style={[TYPE.serif, {
          color: INK,
          fontSize: 28,
          fontStyle: 'italic',
          fontWeight: '500',
          lineHeight: 32,
          marginBottom: 8,
        }]}
      >
        A column, not a checklist.
      </Text>
      <Text style={[TYPE.body, { color: INK_DIM, fontSize: 14, lineHeight: 20, marginBottom: 22 }]}>
        Generate a plan calibrated to your recent rounds — a short read on where
        the strokes are leaking and drills sized to your facilities.
      </Text>

      <PressableTouch
        accessibilityRole="button"
        accessibilityLabel="Generate this week's plan"
        disabled={generating}
        onPress={onGenerate}
        style={{
          backgroundColor: generating ? '#3A4138' : ACCENT,
          borderRadius: 2,
          paddingVertical: 16,
          alignItems: 'center',
          opacity: generating ? 0.7 : 1,
        }}
      >
        {generating ? (
          <ActivityIndicator color={CREAM} />
        ) : (
          <Text style={[TYPE.serif, { color: CREAM, fontSize: 17, fontStyle: 'italic', fontWeight: '500' }]}>
            Generate this week&rsquo;s plan
          </Text>
        )}
      </PressableTouch>
      {generating ? (
        <Text style={[TYPE.body, { color: INK_MUTE, fontSize: 12, textAlign: 'center', marginTop: 10 }]}>
          Reading your rounds and writing the plan… this takes a few seconds.
        </Text>
      ) : null}
      {error ? (
        <Text style={[TYPE.body, { color: '#A33A2A', fontSize: 13, marginTop: 12 }]}>{error}</Text>
      ) : null}

      <View style={{ borderTopWidth: 1, borderColor: LINE, paddingTop: 14, marginTop: 28 }}>
        <Text style={{ ...KICKER, marginBottom: 10 }}>Reference</Text>
        <Link href={'/(app)/learn' as never} asChild>
          <Pressable>
            <Text style={[TYPE.serif, { color: ACCENT, fontSize: 17, fontStyle: 'italic', fontWeight: '500' }]}>
              Learn the stats →
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  )
}

function ReasoningPanel({ note }: { note: string }) {
  return (
    <View style={{ borderLeftWidth: 2, borderColor: ACCENT, paddingLeft: 14, marginBottom: 24 }}>
      <Text style={[TYPE.body, { color: INK_DIM, fontSize: 15, lineHeight: 22 }]}>{note}</Text>
    </View>
  )
}

function FocusAreas({ areas }: { areas: StoredFocusArea[] }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ ...KICKER, marginBottom: 10 }}>Focus areas</Text>
      {areas.map((a, i) => (
        <View key={`focus-${i}`} style={{ marginBottom: 12 }}>
          <Text
            style={[TYPE.serif, {
              color: INK,
              fontSize: 16,
              fontStyle: 'italic',
              fontWeight: '500',
              textTransform: 'capitalize',
            }]}
          >
            {a.category.replace(/_/g, ' ')}
          </Text>
          <Text style={[TYPE.body, { color: INK_DIM, fontSize: 13, lineHeight: 19, marginTop: 2 }]}>
            {a.reason}
          </Text>
        </View>
      ))}
    </View>
  )
}

function SessionBlock({
  session,
  sessionNumber,
  drillsById,
  completed,
  onToggle,
}: {
  session: StoredSession
  sessionNumber: number
  drillsById: Record<string, DrillRow>
  completed: Set<string>
  onToggle: (blockId: string) => void
}) {
  const blocks = [...session.blocks].sort((a, b) => a.order - b.order)
  const doneCount = blocks.filter((b) => completed.has(b.id)).length
  return (
    <View style={{ borderTopWidth: 1, borderColor: LINE, paddingTop: 18, marginBottom: 28 }}>
      <Text style={{ ...KICKER, marginBottom: 6 }}>
        Session {sessionNumber} · {session.total_minutes} min
        {doneCount > 0 ? ` · ${doneCount} of ${blocks.length} done` : ''}
      </Text>
      <Text
        style={[TYPE.serif, { color: INK, fontSize: 21, fontWeight: '500', lineHeight: 26, marginBottom: 6 }]}
      >
        {session.title}
      </Text>
      {blocks.map((block, i) => (
        <DrillRowItem
          key={block.id ?? `${block.drill_id}-${i}`}
          index={i + 1}
          drill={block.drill_id ? drillsById[block.drill_id] : undefined}
          minutes={block.minutes}
          rationale={block.rationale}
          completed={completed.has(block.id)}
          onToggle={() => onToggle(block.id)}
        />
      ))}
    </View>
  )
}

function DrillRowItem({
  index,
  drill,
  minutes,
  rationale,
  completed,
  onToggle,
}: {
  index: number
  drill: DrillRow | undefined
  minutes: number
  rationale: string
  completed: boolean
  onToggle: () => void
}) {
  const [open, setOpen] = useState(false)
  const name = drill?.name ?? 'Drill'
  const instructions = drill?.instructions?.trim() || drill?.description?.trim() || ''
  const canExpand = instructions.length > 0
  return (
    <View style={{ borderTopWidth: 1, borderColor: LINE, paddingVertical: 16, flexDirection: 'row', gap: 12 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={`Mark ${name} done`}
        onPress={onToggle}
        hitSlop={8}
        style={{
          width: 20,
          height: 20,
          borderRadius: 2,
          marginTop: 3,
          borderWidth: completed ? 0 : 1,
          borderColor: '#9F9580',
          backgroundColor: completed ? ACCENT : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {completed ? <Text style={{ color: CREAM, fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
      </Pressable>

      <Text
        style={[TYPE.serif, { color: INK_MUTE, fontSize: 24, fontStyle: 'italic', lineHeight: 26, minWidth: 30 }]}
      >
        {String(index).padStart(2, '0')}
      </Text>

      <View style={{ flex: 1 }}>
        <Pressable onPress={() => canExpand && setOpen((o) => !o)} disabled={!canExpand}>
          <Text
            style={[TYPE.serif, {
              color: completed ? INK_MUTE : INK,
              fontSize: 18,
              fontStyle: 'italic',
              fontWeight: '500',
              lineHeight: 23,
            }]}
          >
            {name}
            {canExpand ? (
              <Text style={{ color: INK_MUTE, fontSize: 13 }}>{open ? '  ▲' : '  ▼'}</Text>
            ) : null}
          </Text>
        </Pressable>
        <Text style={{ ...KICKER, marginTop: 4 }}>
          {minutes} min{drill?.facility?.length ? ` · ${drill.facility.join(', ')}` : ''}
        </Text>
        {rationale ? (
          <Text style={[TYPE.body, { color: INK_DIM, fontSize: 13, lineHeight: 19, marginTop: 6 }]}>
            {rationale}
          </Text>
        ) : null}
        {open && canExpand ? (
          <Text style={[TYPE.body, { color: INK_DIM, fontSize: 14, lineHeight: 21, marginTop: 8 }]}>
            {instructions}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
