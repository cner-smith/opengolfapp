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
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { SectionHead } from '../../components/paper/Section'
import { FONT_CAP, P } from '../../components/paper/tokens'

type Drill = Database['public']['Tables']['drills']['Row']

const META: import('react-native').TextStyle = { ...TYPE.body, color: P.inkDim, fontSize: 12 }

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
    <PaperSurface style={{ flex: 1 }}>
      <AppBar eyebrow="Practice" title="Drill library" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        <Entrance index={0}>
        <Pressable hitSlop={6} onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13 }]}>← Practice plan</Text>
        </Pressable>

        <Text
          maxFontSizeMultiplier={FONT_CAP}
          style={[TYPE.serif, { color: P.ink, fontSize: 26, lineHeight: 31, marginBottom: 6 }]}
        >
          The full set
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14, lineHeight: 20, marginBottom: 22 }]}>
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
            <ActivityIndicator color={P.forest} />
          </View>
        ) : error ? (
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.neg, fontSize: 13, marginTop: 24 }]}>{error}</Text>
        ) : (
          <Entrance index={2}>
            <SectionHead
              title={`${filtered.length} drill${filtered.length === 1 ? '' : 's'}`}
              style={{ marginTop: 14, marginBottom: 0 }}
            />
            {filtered.length === 0 ? (
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.inkDim, fontSize: 17, paddingTop: 14 }]}>
                No drills match those filters.
              </Text>
            ) : (
              filtered.map((drill) => <DrillCard key={drill.id} drill={drill} />)
            )}
          </Entrance>
        )}
      </ScrollView>
    </PaperSurface>
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
    <View style={{ marginBottom: 18 }}>
      <SectionHead title={label} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((chip) => {
          const selected = chip.value === active
          return (
            <Key
              key={chip.value}
              accessibilityLabel={chip.label}
              latched={selected}
              onPress={() => onPick(chip.value)}
              faceStyle={{ minHeight: 40, paddingHorizontal: 12 }}
            >
              <KeyText size={13} bold={selected}>
                {chip.label}
              </KeyText>
            </Key>
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
    <View style={{ borderBottomWidth: 1, borderColor: P.line, paddingVertical: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Pressable onPress={() => canExpand && setOpen((o) => !o)} disabled={!canExpand} style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 18, lineHeight: 23 }]}>
            {drill.name}
            {canExpand ? <Text style={{ color: P.inkDim, fontSize: 13 }}>{open ? '  ▲' : '  ▼'}</Text> : null}
          </Text>
        </Pressable>
        <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
          {drill.duration_min != null ? (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 18, lineHeight: 20 }]}>
              {drill.duration_min} min
            </Text>
          ) : null}
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            style={[TYPE.bodyBold, { color: P.forest, fontSize: 11, marginTop: 4, textAlign: 'right' }]}
          >
            {BLOCK_TYPE_LABEL[drill.drill_type as BlockType] ?? drill.drill_type}
          </Text>
        </View>
      </View>

      {facilities.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {facilities.map((f) => (
            <Text
              key={f}
              maxFontSizeMultiplier={FONT_CAP}
              style={{
                ...TYPE.body,
                color: P.inkDim,
                fontSize: 11,
                backgroundColor: P.well,
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
        <View style={{ borderTopWidth: 1, borderColor: P.line, marginTop: 14, paddingTop: 14 }}>
          {renderInstructions(instructions)}
          {drill.source ? (
            <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, fontSize: 11, marginTop: 14 }}>via {drill.source}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
