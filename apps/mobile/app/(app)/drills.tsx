import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getDrills, getLatestPracticePlan } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { todayLocalDate, type BlockType, type PlanCategory, type StoredSession } from '@oga/core'
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
import { TYPE } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { FONT_CAP, P } from '../../components/paper/tokens'

type Drill = Database['public']['Tables']['drills']['Row']

const META: import('react-native').TextStyle = { ...TYPE.body, color: P.inkDim, fontSize: 12 }

// Category order mirrors a round — off the tee through the green.
const CATEGORIES: PlanCategory[] = ['off_tee', 'approach', 'around_green', 'putting']
const MODES: BlockType[] = ['warmup', 'blocked', 'random', 'skill_game', 'pressure_game', 'on_course']

export default function Drills() {
  const router = useRouter()
  const { user } = useAuth()
  const [drills, setDrills] = useState<Drill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Shot patterns links here with the club's category already chosen.
  const params = useLocalSearchParams<{ category?: string }>()
  const [category, setCategory] = useState<PlanCategory | 'all'>(
    CATEGORIES.includes(params.category as PlanCategory) ? (params.category as PlanCategory) : 'all',
  )
  const [mode, setMode] = useState<BlockType | 'all'>('all')
  const [zToA, setZToA] = useState(false)
  const [planOnly, setPlanOnly] = useState(false)
  const [planIds, setPlanIds] = useState<ReadonlySet<string>>(new Set())
  // expo-router updates params without remounting when Drills is already in the stack.
  useEffect(() => {
    if (CATEGORIES.includes(params.category as PlanCategory)) setCategory(params.category as PlanCategory)
  }, [params.category])

  useEffect(() => {
    let active = true
    setLoading(true)
    getDrills(supabase, {}).then(({ data, error: dErr }) => {
      if (!active) return
      if (dErr) setError(dErr.message)
      else setDrills((data ?? []) as Drill[])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  // This week's plan marks its drills; a plan past its last day isn't this week's.
  useEffect(() => {
    if (!user) return
    let active = true
    getLatestPracticePlan(supabase, user.id).then(({ data }) => {
      if (!active || !data) return
      if (data.valid_until && data.valid_until < todayLocalDate()) return
      const sessions = ((data.drills as { sessions?: StoredSession[] } | null)?.sessions ?? []) as StoredSession[]
      setPlanIds(new Set(sessions.flatMap((s) => (s.blocks ?? []).flatMap((b) => (b.drill_id ? [b.drill_id] : [])))))
    })
    return () => {
      active = false
    }
  }, [user])

  const groups = useMemo(() => {
    const shown = drills.filter(
      (d) =>
        (category === 'all' || d.category === category) &&
        (mode === 'all' || d.drill_type === mode) &&
        (!planOnly || planIds.has(d.id)),
    )
    const order = (a: Drill, b: Drill) => (zToA ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name))
    return [
      ...CATEGORIES.map((c) => ({ key: c as string, title: CATEGORY_LABEL[c], drills: shown.filter((d) => d.category === c) })),
      { key: 'other', title: 'Anywhere', drills: shown.filter((d) => !CATEGORIES.includes(d.category as PlanCategory)) },
    ]
      .filter((g) => g.drills.length > 0)
      .map((g) => ({ ...g, drills: g.drills.sort(order) }))
  }, [drills, category, mode, planOnly, planIds, zToA])

  const showEvery = () => {
    setCategory('all')
    setMode('all')
    setPlanOnly(false)
  }

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar title="Drills" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        <Entrance index={0}>
          <PressableTouch
            accessibilityRole="link"
            hitSlop={6}
            onPress={() => router.back()}
            style={{ marginBottom: 8, minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13 }]}>← Practice</Text>
          </PressableTouch>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14, lineHeight: 20, marginBottom: 14 }]}>
            {drills.length > 0 ? `${drills.length} drills` : 'Every drill'} the plan can draw from, each with the why, the how and a rep
            target. Tap one to read it.
          </Text>
        </Entrance>

        {/* One compact filter row that scrolls sideways: the plan, part of the game, mode, order. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -18, marginBottom: 18 }}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 4, alignItems: 'center', gap: 6 }}
        >
          {planIds.size > 0 ? (
            <>
              <FilterKey label={`In this week’s plan · ${planIds.size}`} on={planOnly} onPress={() => setPlanOnly((v) => !v)} />
              <Divider />
            </>
          ) : null}
          {(['all', ...CATEGORIES] as const).map((c) => (
            <FilterKey key={c} label={c === 'all' ? 'All' : CATEGORY_LABEL[c]} on={category === c} onPress={() => setCategory(c)} />
          ))}
          <Divider />
          {(['all', ...MODES] as const).map((m) => (
            <FilterKey key={m} label={m === 'all' ? 'Any mode' : BLOCK_TYPE_LABEL[m]} on={mode === m} onPress={() => setMode(m)} />
          ))}
          <Divider />
          <FilterKey label={zToA ? 'Z to A' : 'A to Z'} on={false} onPress={() => setZToA((v) => !v)} />
        </ScrollView>

        {loading ? (
          <View style={{ paddingTop: 32, alignItems: 'center' }}>
            <ActivityIndicator color={P.forest} />
          </View>
        ) : error ? (
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.neg, fontSize: 13, marginTop: 24 }]}>{error}</Text>
        ) : groups.length === 0 ? (
          <View style={{ borderTopWidth: 1, borderColor: P.ink, paddingTop: 14 }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 18 }]}>
              {emptyLine(category, mode, planOnly)}
            </Text>
            <PressableTouch
              accessibilityRole="button"
              onPress={showEvery}
              style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
            >
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 14, textDecorationLine: 'underline' }]}>
                Show every drill
              </Text>
            </PressableTouch>
          </View>
        ) : (
          <Entrance index={1}>
            {groups.map((g) => (
              <View key={g.key} style={{ borderTopWidth: 1, borderColor: P.ink, marginBottom: 22 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 4 }}>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 21 }]}>{g.title}</Text>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={META}>
                    {g.drills.length} drill{g.drills.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {g.drills.map((d) => (
                  <IndexLine key={d.id} drill={d} inPlan={planIds.has(d.id)} />
                ))}
              </View>
            ))}
          </Entrance>
        )}
      </ScrollView>
    </PaperSurface>
  )
}

// Web DrillLibraryPage's emptyLine: "No pressure game drills for putting yet."
function emptyLine(category: PlanCategory | 'all', mode: BlockType | 'all', planOnly: boolean): string {
  const what = [
    mode === 'all' ? null : BLOCK_TYPE_LABEL[mode].toLowerCase(),
    'drills',
    category === 'all' ? null : `for ${CATEGORY_LABEL[category].toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' ')
  return planOnly ? `This week’s plan has no ${what}.` : `No ${what} yet.`
}

function FilterKey({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Key accessibilityLabel={label} latched={on} onPress={onPress} faceStyle={{ minHeight: 40, paddingHorizontal: 12 }}>
      <KeyText size={13} bold={on}>
        {label}
      </KeyText>
    </Key>
  )
}

function Divider() {
  return <View style={{ width: 1, height: 24, backgroundColor: P.lineStrong, marginHorizontal: 6 }} />
}

const LEADERS = '. '.repeat(60)

// One index line: name, dot leaders, minutes; mode and facilities under it.
// Tapping opens the drill in place.
function IndexLine({ drill, inPlan }: { drill: Drill; inPlan: boolean }) {
  const [open, setOpen] = useState(false)
  const instructions = drill.instructions?.trim() || drill.description?.trim() || ''
  const canExpand = instructions.length > 0
  const type = drill.drill_type as BlockType
  const meta = [BLOCK_TYPE_LABEL[type] ?? drill.drill_type, ...(drill.facility ?? []).map((f) => FACILITY_LABEL[f] ?? f)].join(' · ')
  return (
    <PressableTouch
      onPress={() => canExpand && setOpen((o) => !o)}
      disabled={!canExpand}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${drill.name}${drill.duration_min != null ? `, ${drill.duration_min} minutes` : ''}${inPlan ? ', in this week’s plan' : ''}`}
      style={{ borderTopWidth: 1, borderColor: P.line, paddingVertical: 10 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 17, lineHeight: 22, flexShrink: 1 }]}>
          {drill.name}
        </Text>
        <View style={{ flex: 1, minWidth: 14, height: 16, overflow: 'hidden' }}>
          <Text numberOfLines={1} ellipsizeMode="clip" style={[TYPE.body, { color: P.lineStrong, fontSize: 11, lineHeight: 16 }]}>
            {LEADERS}
          </Text>
        </View>
        {drill.duration_min != null ? (
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 17, lineHeight: 22 }]}>
            {drill.duration_min}
            <Text style={[TYPE.body, { color: P.inkDim, fontSize: 11 }]}> min</Text>
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
        {MODE_COLOR[type] ? <View style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: MODE_COLOR[type] }} /> : null}
        <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, fontSize: 11, flex: 1 }}>
          {meta}
          {inPlan ? <Text style={[TYPE.bodyBold, { color: P.ink }]}>{' · In this week’s plan'}</Text> : null}
        </Text>
      </View>
      {open && canExpand ? (
        <View style={{ marginTop: 10 }}>
          {renderInstructions(instructions)}
          {drill.source ? (
            <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, fontSize: 11, marginTop: 12 }}>From {drill.source}</Text>
          ) : null}
        </View>
      ) : null}
    </PressableTouch>
  )
}
