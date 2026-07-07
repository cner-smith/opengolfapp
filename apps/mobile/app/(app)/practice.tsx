import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Link } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { StoredBlock, StoredFocusArea, StoredSession } from '@oga/core'
import { AppBar } from '../../components/ui/AppBar'
import { Entrance } from '../../components/ui/Entrance'
import { PressableTouch } from '../../components/ui/PressableTouch'
import {
  BLOCK_TYPE_LABEL,
  CATEGORY_LABEL,
  FACILITY_LABEL,
  renderInstructions,
} from '../../components/practice/drillDisplay'
import { TYPE } from '../../lib/typography'
import { usePracticePlan, type DrillCard as DrillRow } from '../../hooks/usePracticePlan'

const INK = '#1C211C'
const INK_DIM = '#5C6356'
const INK_MUTE = '#8A8B7E'
const LINE = '#D9D2BF'
const ACCENT = '#1F3D2C'
const CREAM = '#F2EEE5'
const NEG = '#A33A2A'

const KICKER: import('react-native').TextStyle = {
  ...TYPE.kicker,
  color: INK_MUTE,
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

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

// UI safety net: rewrite any leaked raw snake_case category enums in displayed
// prose (coach_note / focus reasons). `approach`/`putting` are already readable.
// Tolerates null/undefined — a malformed plan (e.g. a focus area missing its
// `reason`) must degrade to empty text, never crash the whole tab.
function normalizeCategoryProse(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\boff_tee\b/gi, 'off the tee')
    .replace(/\baround_green\b/gi, 'around the green')
}

// `valid_until` / `generated_at` are bare date strings (YYYY-MM-DD). Compare to
// today's *local* date so a plan stays current through the whole of its final day.
function todayDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function formatDate(value: string | null): string {
  if (!value) return ''
  // Parse a bare date string as local, not UTC, to avoid an off-by-one day.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Practice() {
  const { plan, drillsById, loading, generating, error, loadDrills, generate, toggleCompletion, submitFeedback } =
    usePracticePlan()

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

  // No-regenerate-within-window: only offer Generate once the plan's date passed.
  const isExpired = !!plan?.valid_until && plan.valid_until < todayDateString()
  const kicker = !plan
    ? ''
    : isExpired
      ? `Last week's plan · valid through ${formatDate(plan.valid_until)}`
      : `Practice plan · week of ${formatDate(plan.generated_at)}${plan.valid_until ? ` · valid through ${formatDate(plan.valid_until)}` : ''}`

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <AppBar
        eyebrow="Today's focus"
        title="Practice"
        right={
          <Link href={'/(app)/learn' as never} asChild>
            <PressableTouch
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
              <MaterialCommunityIcons name="book-open-variant" size={14} color="#F2EEE5" />
              <Text style={{ color: '#F2EEE5', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 }}>
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
          <NoPlan generating={generating} error={error} onGenerate={generate} />
        ) : (
          <>
            <Entrance index={0}>
            <Text style={{ ...KICKER, marginBottom: 8 }}>{kicker}</Text>
            <Text
              style={[TYPE.serif, {
                color: INK,
                fontSize: 26,
                lineHeight: 31,
                marginBottom: isExpired ? 14 : 18,
              }]}
            >
              {plan.ai_insight ?? 'Your practice plan'}
            </Text>

            {/* Regenerate affordance — only once the current plan has expired. */}
            {isExpired ? (
              <PressableTouch
                accessibilityRole="button"
                accessibilityLabel="Generate this week's plan"
                disabled={generating}
                onPress={generate}
                style={{
                  backgroundColor: generating ? '#3A4138' : ACCENT,
                  borderRadius: 2,
                  paddingVertical: 13,
                  alignItems: 'center',
                  marginBottom: 22,
                  opacity: generating ? 0.7 : 1,
                }}
              >
                {generating ? (
                  <ActivityIndicator color={CREAM} />
                ) : (
                  <Text style={[TYPE.serif, { color: CREAM, fontSize: 16 }]}>
                    Generate this week’s plan
                  </Text>
                )}
              </PressableTouch>
            ) : null}

            {error ? (
              <Text style={[TYPE.body, { color: NEG, fontSize: 13, marginBottom: 14 }]}>{error}</Text>
            ) : null}
            </Entrance>

            {plan.coach_note ? (
              <Entrance index={1}>
                <ReasoningPanel note={plan.coach_note} />
              </Entrance>
            ) : null}

            {focusAreas.length > 0 ? (
              <Entrance index={2}>
                <FocusAreas areas={focusAreas} />
              </Entrance>
            ) : null}

            <Entrance index={3}>
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
            </Entrance>

            <Entrance index={4}>
            {plan.id ? (
              <FeedbackSection key={plan.id} initial={plan.feedback ?? ''} onSave={submitFeedback} />
            ) : null}

            {plan.based_on_rounds ? (
              <Text style={{ ...KICKER, paddingTop: 4 }}>
                Based on your last {plan.based_on_rounds} round
                {plan.based_on_rounds === 1 ? '' : 's'}
              </Text>
            ) : null}

            <View style={{ borderTopWidth: 1, borderColor: LINE, marginTop: 28, paddingTop: 18 }}>
              <Link href={'/(app)/drills' as never} asChild>
                <Pressable hitSlop={6}>
                  <Text style={[TYPE.serif, { color: ACCENT, fontSize: 17 }]}>
                    Browse all drills →
                  </Text>
                </Pressable>
              </Link>
            </View>
            </Entrance>
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
          lineHeight: 32,
          marginBottom: 8,
        }]}
      >
        Your game, read closely.
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
          <Text style={[TYPE.serif, { color: CREAM, fontSize: 17 }]}>
            Generate this week’s plan
          </Text>
        )}
      </PressableTouch>
      {generating ? (
        <Text style={[TYPE.body, { color: INK_MUTE, fontSize: 12, textAlign: 'center', marginTop: 10 }]}>
          Reading your rounds and writing the plan… this takes a few seconds.
        </Text>
      ) : null}
      {error ? (
        <Text style={[TYPE.body, { color: NEG, fontSize: 13, marginTop: 12 }]}>{error}</Text>
      ) : null}

      <View style={{ borderTopWidth: 1, borderColor: LINE, paddingTop: 14, marginTop: 28 }}>
        <Text style={{ ...KICKER, marginBottom: 10 }}>Reference</Text>
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

function ReasoningPanel({ note }: { note: string }) {
  return (
    <View style={{ borderLeftWidth: 2, borderColor: ACCENT, paddingLeft: 14, marginBottom: 24 }}>
      <Text style={[TYPE.body, { color: INK_DIM, fontSize: 15, lineHeight: 22 }]}>
        {normalizeCategoryProse(note)}
      </Text>
    </View>
  )
}

function FocusAreas({ areas }: { areas: StoredFocusArea[] }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ ...KICKER, marginBottom: 10 }}>What to work on</Text>
      {areas.map((a, i) => (
        <View key={`focus-${i}`} style={{ marginBottom: 14 }}>
          <Text style={[TYPE.serif, { color: INK, fontSize: 16 }]}>
            {CATEGORY_LABEL[a.category] ?? a.category}
          </Text>
          <Text style={[TYPE.body, { color: INK_DIM, fontSize: 13, lineHeight: 19, marginTop: 2 }]}>
            {normalizeCategoryProse(a.reason)}
          </Text>
          {a.article ? (
            <Link
              href={{ pathname: '/(app)/learn/[article]', params: { article: a.article.slug } }}
              asChild
            >
              <Pressable hitSlop={6} style={{ marginTop: 6 }}>
                <Text style={[TYPE.bodyBold, { color: ACCENT, fontSize: 13 }]}>
                  {a.article.title} →
                </Text>
              </Pressable>
            </Link>
          ) : null}
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
  const blocks = [...(session.blocks ?? [])].sort((a, b) => a.order - b.order)
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
          block={block}
          drill={block.drill_id ? drillsById[block.drill_id] : undefined}
          completed={completed.has(block.id)}
          onToggle={() => onToggle(block.id)}
        />
      ))}
    </View>
  )
}

function DrillRowItem({
  index,
  block,
  drill,
  completed,
  onToggle,
}: {
  index: number
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

      {/* The whole row (everything but the checkbox) toggles expand, so a thumb
          tap anywhere on the card opens it — not just the chevron. Matches the
          drill-library card affordance. */}
      <Pressable
        onPress={() => canExpand && setOpen((o) => !o)}
        disabled={!canExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${name}${canExpand ? `, tap to ${open ? 'collapse' : 'expand'}` : ''}`}
        style={{ flex: 1, flexDirection: 'row', gap: 12 }}
      >
        <Text
          style={[TYPE.serif, { color: INK_MUTE, fontSize: 24, lineHeight: 26, minWidth: 30 }]}
        >
          {String(index).padStart(2, '0')}
        </Text>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text
              style={[TYPE.serif, {
                color: completed ? INK_MUTE : INK,
                fontSize: 18,
                lineHeight: 23,
                flex: 1,
              }]}
            >
              {name}
              {canExpand ? (
                <Text style={{ color: INK_MUTE, fontSize: 13 }}>{open ? '  ▲' : '  ▼'}</Text>
              ) : null}
            </Text>

            {/* Right rail — minutes + block type tag + optional target. */}
            <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
              <Text style={[TYPE.serif, { color: INK, fontSize: 18, lineHeight: 20 }]}>
                {block.minutes} min
              </Text>
              <Text
                style={{ ...KICKER, color: ACCENT, fontSize: 9, letterSpacing: 1.6, marginTop: 4, textAlign: 'right' }}
              >
                {BLOCK_TYPE_LABEL[block.type] ?? block.type}
              </Text>
              {block.target != null ? (
                <Text style={{ ...KICKER, fontSize: 9, marginTop: 6, textAlign: 'right' }}>
                  Target: {block.target}
                </Text>
              ) : null}
            </View>
          </View>

          {block.rationale ? (
            <Text style={[TYPE.body, { color: INK_DIM, fontSize: 13, lineHeight: 19, marginTop: 6 }]}>
              {block.rationale}
            </Text>
          ) : null}

          {facilities.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {facilities.map((f) => (
                <Text
                  key={f}
                  style={{
                    ...KICKER,
                    color: INK_DIM,
                    fontSize: 9,
                    backgroundColor: '#E8E2D2',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  {FACILITY_LABEL[f] ?? f}
                </Text>
              ))}
            </View>
          ) : null}

          {open && canExpand ? (
            <View style={{ borderTopWidth: 1, borderColor: LINE, marginTop: 14, paddingTop: 14 }}>
              {renderInstructions(instructions)}
              {drill?.source ? (
                <Text style={{ ...KICKER, color: INK_MUTE, fontSize: 9, marginTop: 14 }}>
                  via {drill.source}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
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
    <View style={{ borderTopWidth: 1, borderColor: LINE, paddingTop: 18, marginBottom: 28 }}>
      <Text style={{ ...KICKER, marginBottom: 8 }}>Before next week</Text>
      <Text style={[TYPE.body, { color: INK_DIM, fontSize: 14, lineHeight: 20, marginBottom: 12 }]}>
        One note on how this plan landed — what worked, what felt off. Next week’s plan reads it.
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
          backgroundColor: '#FBF8F1',
          borderWidth: 1,
          borderColor: LINE,
          borderRadius: 2,
          padding: 12,
          fontSize: 15,
          lineHeight: 21,
        }]}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <Text style={{ ...KICKER, fontSize: 9 }}>{saving ? 'Saving…' : showSaved ? 'Saved' : ''}</Text>
        <Text style={{ ...KICKER, fontSize: 9 }}>
          {value.length} / {FEEDBACK_MAX}
        </Text>
      </View>
    </View>
  )
}
