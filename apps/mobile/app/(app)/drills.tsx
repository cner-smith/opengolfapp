import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { getDrills } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import type { BlockType, PlanCategory } from '@oga/core'
import { AppBar } from '../../components/ui/AppBar'
import { Entrance } from '../../components/ui/Entrance'
import {
  BLOCK_TYPE_LABEL,
  CATEGORY_LABEL,
  FACILITY_LABEL,
  renderInstructions,
} from '../../components/practice/drillDisplay'
import { TYPE } from '../../lib/typography'
import { supabase } from '../../lib/supabase'

type Drill = Database['public']['Tables']['drills']['Row']

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

// Category order mirrors a round — off the tee through the green.
const CATEGORIES: PlanCategory[] = ['off_tee', 'approach', 'around_green', 'putting']
const MODES: BlockType[] = ['warmup', 'blocked', 'random', 'skill_game', 'pressure_game', 'on_course']

export default function Drills() {
  const router = useRouter()
  const [drills, setDrills] = useState<Drill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<PlanCategory | 'all'>('all')
  const [mode, setMode] = useState<BlockType | 'all'>('all')

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

  const filtered = useMemo(
    () =>
      drills.filter(
        (d) =>
          (category === 'all' || d.category === category) &&
          (mode === 'all' || d.drill_type === mode),
      ),
    [drills, category, mode],
  )

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <AppBar eyebrow="Practice" title="Drill library" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        <Entrance index={0}>
        <Pressable hitSlop={6} onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text style={{ ...KICKER, color: INK_MUTE }}>← Practice plan</Text>
        </Pressable>

        <Text
          style={[TYPE.serif, { color: INK, fontSize: 26, fontWeight: '500', lineHeight: 31, marginBottom: 6 }]}
        >
          The full set
        </Text>
        <Text style={[TYPE.body, { color: INK_DIM, fontSize: 14, lineHeight: 20, marginBottom: 18 }]}>
          Every drill the plan generator can draw from. Each one explains the why,
          the how, and the rep target — no gimmicks.
        </Text>
        </Entrance>

        <Entrance index={1}>
        <FilterRow
          label="Part of the game"
          active={category}
          options={CATEGORIES}
          labelFor={(c) => CATEGORY_LABEL[c]}
          onPick={setCategory}
        />
        <FilterRow
          label="Practice mode"
          active={mode}
          options={MODES}
          labelFor={(m) => BLOCK_TYPE_LABEL[m]}
          onPick={setMode}
        />
        </Entrance>

        {loading ? (
          <View style={{ paddingTop: 32, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : error ? (
          <Text style={[TYPE.body, { color: NEG, fontSize: 13, marginTop: 24 }]}>{error}</Text>
        ) : (
          <Entrance index={2}>
            <Text style={{ ...KICKER, marginTop: 22, marginBottom: 2 }}>
              {filtered.length} drill{filtered.length === 1 ? '' : 's'}
            </Text>
            {filtered.length === 0 ? (
              <Text style={[TYPE.serif, { color: INK_DIM, fontSize: 17, paddingTop: 14 }]}>
                No drills match those filters.
              </Text>
            ) : (
              filtered.map((drill) => <DrillCard key={drill.id} drill={drill} />)
            )}
          </Entrance>
        )}
      </ScrollView>
    </View>
  )
}

function FilterRow<T extends string>({
  label,
  active,
  options,
  labelFor,
  onPick,
}: {
  label: string
  active: T | 'all'
  options: T[]
  labelFor: (value: T) => string
  onPick: (value: T | 'all') => void
}) {
  const chips: Array<{ value: T | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    ...options.map((o) => ({ value: o, label: labelFor(o) })),
  ]
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ ...KICKER, marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((chip) => {
          const selected = chip.value === active
          return (
            <Pressable
              key={chip.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onPick(chip.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 2,
                borderWidth: selected ? 0 : 1,
                borderColor: LINE,
                backgroundColor: selected ? ACCENT : '#FBF8F1',
              }}
            >
              <Text
                style={[TYPE.bodyBold, {
                  fontSize: 12,
                  fontWeight: '600',
                  color: selected ? CREAM : INK_DIM,
                }]}
              >
                {chip.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function DrillCard({ drill }: { drill: Drill }) {
  const [open, setOpen] = useState(false)
  const facilities = drill.facility ?? []
  const instructions = drill.instructions?.trim() || drill.description?.trim() || ''
  const canExpand = instructions.length > 0
  return (
    <View style={{ borderBottomWidth: 1, borderColor: LINE, paddingVertical: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Pressable onPress={() => canExpand && setOpen((o) => !o)} disabled={!canExpand} style={{ flex: 1 }}>
          <Text style={[TYPE.serif, { color: INK, fontSize: 18, lineHeight: 23 }]}>
            {drill.name}
            {canExpand ? <Text style={{ color: INK_MUTE, fontSize: 13 }}>{open ? '  ▲' : '  ▼'}</Text> : null}
          </Text>
        </Pressable>
        <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
          {drill.duration_min != null ? (
            <Text style={[TYPE.serif, { color: INK, fontSize: 18, lineHeight: 20 }]}>
              {drill.duration_min} min
            </Text>
          ) : null}
          <Text style={{ ...KICKER, color: ACCENT, fontSize: 9, letterSpacing: 1.6, marginTop: 4, textAlign: 'right' }}>
            {BLOCK_TYPE_LABEL[drill.drill_type as BlockType] ?? drill.drill_type}
          </Text>
        </View>
      </View>

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
          {drill.source ? (
            <Text style={{ ...KICKER, color: INK_MUTE, fontSize: 9, marginTop: 14 }}>via {drill.source}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
