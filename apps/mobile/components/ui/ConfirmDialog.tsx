import { Modal, Pressable, Text, View } from 'react-native'
import { TYPE } from '../../lib/typography'
import { HardShadow, Key, KeyText, PaperSurface } from '../paper/Paper'
import { GAP, P, R } from '../paper/tokens'

interface ConfirmDialogProps {
  visible: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

// Paper confirm dialog (#611 §11): raised paper with grain, hard 3/3 shadow,
// two equal keys — the confirm is the only filled control on screen (forest,
// or brick when destructive). A scrim tap or Back cancels.
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tone = destructive ? 'danger' : 'primary'
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: P.scrim, justifyContent: 'center', paddingHorizontal: 24 }}>
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={busy ? undefined : onCancel}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <HardShadow dx={3} dy={3} style={{ alignSelf: 'center', width: '100%', maxWidth: 420 }}>
          <PaperSurface
            fill={P.raised}
            style={{ borderWidth: 1, borderColor: P.ink, borderRadius: R, paddingTop: 22, paddingHorizontal: 22, paddingBottom: 25 }}
          >
            <Text style={[TYPE.serif, { color: P.ink, fontSize: 24, lineHeight: 29 }]}>{title}</Text>
            {message ? (
              <Text style={[TYPE.body, { color: P.ink, fontSize: 15, lineHeight: 21, marginTop: 8 }]}>{message}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: GAP, marginTop: 22 }}>
              <Key
                accessibilityLabel={cancelLabel}
                onPress={onCancel}
                disabled={busy}
                style={{ flex: 1 }}
                faceStyle={{ minHeight: 48, paddingHorizontal: 8 }}
              >
                <KeyText size={15} disabled={busy}>
                  {cancelLabel}
                </KeyText>
              </Key>
              <Key
                accessibilityLabel={confirmLabel}
                tone={tone}
                onPress={onConfirm}
                disabled={busy}
                style={{ flex: 1 }}
                faceStyle={{ minHeight: 48, paddingHorizontal: 8 }}
              >
                <KeyText tone={tone} bold size={15} disabled={busy}>
                  {busy ? 'Working…' : confirmLabel}
                </KeyText>
              </Key>
            </View>
          </PaperSurface>
        </HardShadow>
      </View>
    </Modal>
  )
}
