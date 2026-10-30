import { useEffect, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CAPTURE_MODES,
  CAPTURE_MODE_LABELS,
  HOLE_COUNT_KEYS,
  MAX_ROUND_HOLES,
  guessHoleCount,
  isFinishedRound,
  isRoundHoleCount,
  type CaptureMode,
} from '@oga/core'
import { getCourseTees } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import { TYPE } from '../../../lib/typography'
import { getCached } from '../../../lib/screenCache'
import { TeePicker } from '../RoundTeeSelector'
import { Key, KeyText } from '../../paper/Paper'
import { SectionHead } from '../../paper/Section'
import { FONT_CAP, P } from '../../paper/tokens'
import { META, inputStyle } from './styles'

// Setup step shown after a course is resolved but before the round is
// created — mirrors web's NewRoundPage where the tee is an up-front field.
// Tee is optional so it never blocks pace of play; "Start round" works with
// no tee picked, and the scorecard can still set it later.
export function RoundSetupStep({
  courseId,
  courseName,
  mode,
  initialCapture,
  busy,
  onBack,
  onStart,
}: {
  courseId: string
  courseName: string
  mode: 'live' | 'past'
  /** Set by the Patterns preview's "Track shot patterns" button (#1076). */
  initialCapture?: CaptureMode
  busy: boolean
  onBack: () => void
  onStart: (
    courseTeeId: string | null,
    teeColor: string | null,
    captureMode: CaptureMode,
    holeCount: number,
  ) => void
}) {
  const insets = useSafeAreaInsets()
  const [teeId, setTeeId] = useState<string | null>(null)
  const [teeColor, setTeeColor] = useState<string | null>(null)
  // #1054: a player's first live round opens on "Just track my round" (live
  // shot tracking was what made new players quit early), and the round after
  // their first finished one nudges toward shot patterns. Read from Home's
  // cached recent rounds — Home is the only way here — rather than a new
  // query. No cache (Home's fetch failed or hasn't landed) = old default.
  const [finishedRounds] = useState(() =>
    getCached<{ completed_at: string | null; total_score: number | null }[]>('home:rounds')
      ?.filter(isFinishedRound).length,
  )
  const [captureMode, setCaptureMode] = useState<CaptureMode>(
    initialCapture ?? (finishedRounds === 0 ? 'just_track' : 'track_patterns'),
  )

  // The round stores how many holes it plays (#727), as on web: the row
  // starts on a guess from the holes on file and the tee's par, and the
  // player can change it. Other opens a field for any count from 1 to 18.
  const [course, setCourse] = useState<{ holeNumbers: number[]; tees: { id: string; par: number | null }[] } | null>(null)
  const [holeChoice, setHoleChoice] = useState<number | null>(null)
  const [otherHoles, setOtherHoles] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [h, t] = await Promise.all([
          supabase.from('holes').select('number').eq('course_id', courseId),
          getCourseTees(supabase, courseId),
        ])
        if (active) setCourse({ holeNumbers: (h.data ?? []).map((r) => r.number), tees: t.data ?? [] })
      } catch {
        // Offline: start from the no-data guess rather than block the round.
        if (active) setCourse({ holeNumbers: [], tees: [] })
      }
    })()
    return () => {
      active = false
    }
  }, [courseId])
  const teePar = course ? (course.tees.find((t) => t.id === teeId) ?? course.tees[0])?.par : null
  const guessedHoles = guessHoleCount(teePar, course?.holeNumbers ?? [])
  const holeCount = otherHoles != null ? Number(otherHoles) : (holeChoice ?? guessedHoles)
  const onKey = otherHoles == null && (HOLE_COUNT_KEYS as readonly number[]).includes(holeCount)
  const holesValid = otherHoles == null || (otherHoles !== '' && isRoundHoleCount(holeCount))
  const startDisabled = busy || !course || !holesValid

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: P.chrome,
        paddingTop: insets.top + 14,
        paddingHorizontal: 18,
      }}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, marginBottom: 6 }}>
        {mode === 'past' ? 'Log past round' : 'Start live round'}
      </Text>
      <Text
        maxFontSizeMultiplier={FONT_CAP}
        style={[TYPE.serif, {
          color: P.ink,
          fontSize: 28,
          marginBottom: 18,
        }]}
      >
        {courseName}
      </Text>

      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        {mode === 'live' && (
          <View style={{ marginBottom: 22 }}>
            <SectionHead title="How do you want to track it?" />
            {CAPTURE_MODES.map((cm) => {
              const active = captureMode === cm
              return (
                <Key
                  key={cm}
                  accessibilityLabel={CAPTURE_MODE_LABELS[cm].title}
                  latched={active}
                  onPress={() => setCaptureMode(cm)}
                  style={{ marginBottom: 8 }}
                  faceStyle={{ alignItems: 'stretch', padding: 14 }}
                >
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.ink, fontSize: 15, marginBottom: 2 }]}>
                    {CAPTURE_MODE_LABELS[cm].title}
                  </Text>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12 }]}>
                    {CAPTURE_MODE_LABELS[cm].subtitle}
                  </Text>
                  {cm === 'track_patterns' && finishedRounds === 1 && (
                    <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyItalic, { color: P.forest, fontSize: 12, marginTop: 6 }]}>
                      One round in. This is a good one to start your shot patterns.
                    </Text>
                  )}
                </Key>
              )
            })}
          </View>
        )}

        <SectionHead title="Holes" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
          {HOLE_COUNT_KEYS.map((n) => (
            <Key
              key={n}
              accessibilityLabel={`${n} holes`}
              latched={onKey && holeCount === n}
              disabled={!course}
              onPress={() => {
                setOtherHoles(null)
                setHoleChoice(n)
              }}
              faceStyle={{ minHeight: 44, minWidth: 48, paddingHorizontal: 12 }}
            >
              <KeyText size={14} bold={onKey && holeCount === n} disabled={!course}>
                {n}
              </KeyText>
            </Key>
          ))}
          <Key
            accessibilityLabel="Other number of holes"
            latched={!onKey}
            disabled={!course}
            onPress={() => setOtherHoles((t) => t ?? '')}
            faceStyle={{ minHeight: 44, paddingHorizontal: 14 }}
          >
            <KeyText size={14} bold={!onKey} disabled={!course}>
              Other
            </KeyText>
          </Key>
          {otherHoles != null && (
            <TextInput
              value={otherHoles}
              onChangeText={(t) => setOtherHoles(t.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              autoFocus
              accessibilityLabel="Number of holes"
              placeholder={`1–${MAX_ROUND_HOLES}`}
              placeholderTextColor={P.inkDim}
              maxFontSizeMultiplier={FONT_CAP}
              style={[inputStyle, { width: 72, minHeight: 44, paddingVertical: 8, textAlign: 'center' }]}
            />
          )}
        </View>
        {!holesValid && (
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginTop: -14, marginBottom: 18 }]}>
            A whole number from 1 to {MAX_ROUND_HOLES}.
          </Text>
        )}

        <SectionHead title="Tee played" style={{ marginBottom: 4 }} />
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 12 }]}>
          Optional — add the tee's rating and slope for a handicap differential.
          You can set it later from the scorecard.
        </Text>

        <TeePicker
          courseId={courseId}
          selectedTeeId={teeId}
          onSelect={(t) => {
            setTeeId(t.id)
            setTeeColor(t.tee_color)
          }}
          busy={busy}
        />
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          paddingVertical: 14,
          paddingBottom: insets.bottom + 14,
        }}
      >
        <Key accessibilityLabel="Back" onPress={onBack} disabled={busy} style={{ flex: 1 }} faceStyle={{ minHeight: 48 }}>
          <KeyText size={13} disabled={busy}>Back</KeyText>
        </Key>
        <Key
          tone="primary"
          accessibilityLabel={busy ? 'Starting…' : mode === 'past' ? 'Log round →' : 'Start round →'}
          onPress={() => onStart(teeId, teeColor, captureMode, holeCount)}
          disabled={startDisabled}
          style={{ flex: 2 }}
          faceStyle={{ minHeight: 48 }}
        >
          <KeyText tone="primary" bold disabled={startDisabled}>
            {busy ? 'Starting…' : mode === 'past' ? 'Log round →' : 'Start round →'}
          </KeyText>
        </Key>
      </View>
    </View>
  )
}
