import { Modal, Pressable, Text, View } from 'react-native'

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

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

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
  const confirmBg = destructive ? '#A33A2A' : '#1F3D2C'
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(28,33,28,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
        }}
      >
        <View
          style={{
            backgroundColor: '#FBF8F1',
            borderColor: '#9F9580',
            borderWidth: 1,
            borderRadius: 4,
            padding: 22,
            width: '100%',
            maxWidth: 360,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 8 }}>
            {destructive ? 'Confirm delete' : 'Confirm'}
          </Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 22,
              fontStyle: 'italic',
              fontWeight: '500',
              lineHeight: 28,
              marginBottom: message ? 10 : 22,
            }}
          >
            {title}
          </Text>
          {message && (
            <Text
              style={{
                color: '#5C6356',
                fontSize: 14,
                lineHeight: 20,
                marginBottom: 22,
              }}
            >
              {message}
            </Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={{
                borderWidth: 1,
                borderColor: '#D9D2BF',
                borderRadius: 2,
                paddingHorizontal: 14,
                paddingVertical: 10,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text style={{ color: '#5C6356', fontSize: 13, fontWeight: '500' }}>
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={{
                backgroundColor: confirmBg,
                borderRadius: 2,
                paddingHorizontal: 16,
                paddingVertical: 10,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  color: '#F2EEE5',
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}
              >
                {busy ? 'Working…' : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
