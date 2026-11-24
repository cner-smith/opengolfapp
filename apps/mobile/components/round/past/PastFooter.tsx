import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TYPE } from '../../../lib/typography'
import { Icon } from '../../paper/icons'
import { Key, PaperSurface, Rocker } from '../../paper/Paper'
import { FONT_CAP, GAP, MARGIN, P } from '../../paper/tokens'
import { Em, NoPinVoice, Primary, Secondary, SmallKey, Voice } from '../../paper/Dock'
import { CoachTarget } from '../../help/CoachMarks'

export type PastMode = 'PLACE_BALL' | 'SET_AIM' | 'PIN'

// Paper footer shared by logging (§19.4) and review (§19.5): voice line or
// stepper row over the buttons, on chrome + grain above the nav bar.
export function PastFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <PaperSurface
      style={{
        borderTopWidth: 1,
        borderTopColor: P.ink,
        paddingHorizontal: MARGIN,
        paddingBottom: insets.bottom + 7,
      }}
    >
      {children}
    </PaperSurface>
  )
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'stretch' }}>{children}</View>
}

// §19.5 stepper row: [‹] "Shot 2 of 5" / summary [›].
export function ShotStepperRow({
  pos,
  count,
  summary,
  onPrev,
  onNext,
}: {
  pos: number
  count: number
  summary: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8, paddingTop: 8, paddingBottom: 6 }}>
      <Key accessibilityLabel="Previous shot" onPress={onPrev} disabled={pos <= 0} faceStyle={{ width: 44, height: 44 }}>
        <Icon.prev size={20} color={pos <= 0 ? P.ink35 : P.ink} />
      </Key>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
        <Text maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} style={[TYPE.serif, { fontSize: 18, lineHeight: 22, color: P.ink }]}>
          Shot {pos + 1} of {count}
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} style={[TYPE.body, { fontSize: 13, lineHeight: 17, color: P.ink, textAlign: 'center' }]}>
          {summary}
        </Text>
      </View>
      <Key
        accessibilityLabel="Next shot"
        onPress={onNext}
        disabled={pos >= count - 1}
        faceStyle={{ width: 44, height: 44 }}
      >
        <Icon.next size={20} color={pos >= count - 1 ? P.ink35 : P.ink} />
      </Key>
    </View>
  )
}

const MODES = [
  { value: 'PLACE_BALL' as const, label: 'Ball', icon: () => <Icon.ball size={18} /> },
  { value: 'SET_AIM' as const, label: 'Aim', icon: () => <Icon.aim size={18} /> },
  { value: 'PIN' as const, label: 'Pin', icon: () => <Icon.pin size={18} /> },
]

// Logging's [Ball | Aim | Pin] rocker (§19.4): glyph beside the label (PR6e),
// Aim disabled until the ball is placed. Sets what a map tap does.
export function ModeRocker({
  value,
  onChange,
  aimDisabled,
  noPin,
}: {
  value: PastMode
  onChange: (m: PastMode) => void
  aimDisabled: boolean
  /** The green view sets the pin on courses with green maps (#1504 follow-up). */
  noPin: boolean
}) {
  return (
    <Rocker
      options={MODES.filter((m) => !(noPin && m.value === 'PIN')).map((m) => ({ ...m, disabled: m.value === 'SET_AIM' && aimDisabled }))}
      value={value}
      onChange={(m) => m && onChange(m)}
      iconBeside
      style={{ width: noPin ? 124 : 186 }}
    />
  )
}

// The past-round footer's controls: logging (§19.4) or review (§19.5), one
// branch per state. Layout only; PastRoundMap owns the state and the saves.
export function PastControls(p: {
  completed: boolean
  mode: PastMode
  hasPin: boolean
  /** The selected shot's number. */
  n: number
  placedNow: boolean
  startedCount: number
  onlyDraft: boolean
  adding: boolean
  addingNumber: number
  count: number
  pos: number
  summary: string
  isLast: boolean
  canEdit: boolean
  onMode: (m: PastMode) => void
  onRemove: () => void
  onAdd: () => void
  onStartAdd: () => void
  onCancelAdd: () => void
  onStep: (pos: number) => void
  onEdit: () => void
}) {
  const { completed, mode, hasPin, n, placedNow, startedCount, onlyDraft, adding, addingNumber, count, pos, summary, isLast, canEdit } = p
  const { onMode, onRemove, onAdd, onStartAdd, onCancelAdd, onStep, onEdit } = p
  return (
    <CoachTarget id="past.footer">
    <PastFooter>
      {mode === 'PIN' && completed ? (
        <Voice trailing={<SmallKey label="Cancel" a11y="Cancel pin placement" onPress={() => onMode('PLACE_BALL')} />}>
          <Em>Where’s the flag?</Em> Tap it on the map.
        </Voice>
      ) : !completed ? (
        /* ───────── LOGGING (§19.4) ───────── */
        <>
          {mode === 'PIN' ? (
            <Voice
              trailing={
                <SmallKey label="Cancel" a11y="Cancel pin placement" onPress={() => onMode('PLACE_BALL')} />
              }
            >
              <Em>Where’s the flag?</Em> Tap it on the map.
            </Voice>
          ) : !hasPin ? (
            <NoPinVoice onPress={() => onMode('PIN')} />
          ) : mode === 'SET_AIM' ? (
            <Voice>
              <Em>Tap where you aimed shot {n}.</Em>
            </Voice>
          ) : !placedNow ? (
            startedCount === 0 ? (
              <Voice>
                <Em>Tap the map where you hit shot {n}.</Em>
              </Voice>
            ) : (
              <Voice>
                Shot {n - 1} is on the map. <Em>Tap where you hit shot {n}.</Em>
              </Voice>
            )
          ) : (
            <Voice>
              {/* The primary below says "Add shot N+1"; repeating it here
                  orphaned the number onto a second line. */}
              Shot {n} is on the map. <Em>Drag to fine-tune.</Em>
            </Voice>
          )}
          <ButtonRow>
            <Secondary
              // Broken on purpose: at maxWidth 120 it wrapped as "Remove shot / 1".
              label={`Remove\nshot ${n}`}
              a11y="Remove this shot"
              onPress={onRemove}
              disabled={!placedNow && onlyDraft}
            />
            <Primary
              plus
              label={`Add shot ${n + 1}`}
              a11y="Add another shot"
              onPress={onAdd}
              disabled={!placedNow}
            />
          </ButtonRow>
        </>
      ) : adding ? (
        /* ───────── REVIEW: placing a newly added shot ───────── */
        <Voice trailing={<SmallKey label="Cancel" a11y="Cancel adding shot" onPress={onCancelAdd} />}>
          <Em>Tap the map where you hit shot {addingNumber}.</Em>
        </Voice>
      ) : count === 0 ? (
        /* ───────── REVIEW: finalized hole with no shots ───────── */
        <>
          <Voice>No shots logged for this hole.</Voice>
          <ButtonRow>
            <Primary plus label="Add shot" a11y="Add the first shot" onPress={onStartAdd} />
          </ButtonRow>
        </>
      ) : (
        /* ───────── REVIEW: shot stepper (§19.5) ───────── */
        <>
          <ShotStepperRow
            pos={pos}
            count={count}
            summary={summary}
            onPrev={() => onStep(pos - 1)}
            onNext={() => onStep(pos + 1)}
          />
          <ButtonRow>
            <Secondary label="Remove" a11y="Remove this shot" color={P.neg} onPress={onRemove} />
            {/* Adding is only offered off the last shot (#593). */}
            {isLast && (
              <Secondary
                label="Add shot"
                a11y="Add another shot"
                icon={<Icon.plus size={18} />}
                onPress={onStartAdd}
              />
            )}
            <Primary
              label={`Edit shot ${pos + 1}`}
              a11y="Edit this shot's details"
              disabled={!canEdit}
              onPress={onEdit}
            />
          </ButtonRow>
        </>
      )}
    </PastFooter>
    </CoachTarget>
  )
}
