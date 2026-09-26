import { ActivityIndicator, Text } from 'react-native'
import { TYPE } from '../../lib/typography'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Key, KeyText, PaperSurface } from '../paper/Paper'
import { P } from '../paper/tokens'

// Live round's loading spinner and its "couldn't load" screen, split out of
// LiveRoundSession to keep that file under the size cap.
export function LiveRoundError({
  loading,
  error,
  holeNumber,
  onRetry,
  exitOpen,
  onAskExit,
  onCancelExit,
  onConfirmExit,
}: {
  loading: boolean
  error: boolean
  holeNumber: number
  onRetry: () => void
  exitOpen: boolean
  onAskExit: () => void
  onCancelExit: () => void
  onConfirmExit: () => void
}) {
  if (loading) {
    return (
      <PaperSurface style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={P.forest} />
      </PaperSurface>
    )
  }
  return (
    <PaperSurface style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <Text style={[TYPE.serif, { color: P.ink, fontSize: 24, textAlign: 'center', marginBottom: 10 }]}>
        {error ? 'Something went wrong loading this round.' : `Hole ${holeNumber} isn't set up for this round yet.`}
      </Text>
      <Text style={[TYPE.body, { color: P.ink, fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 22 }]}>
        {error
          ? 'Check your connection and try again, or leave and resume this round later.'
          : 'Try again, or leave and pick this round back up from the home screen.'}
      </Text>
      <Key
        accessibilityLabel="Try again"
        tone="primary"
        onPress={onRetry}
        style={{ alignSelf: 'stretch', marginBottom: 10 }}
        faceStyle={{ minHeight: 49 }}
      >
        <KeyText tone="primary" bold size={16}>
          Try again
        </KeyText>
      </Key>
      <Key
        accessibilityLabel="Leave and go to the home screen"
        onPress={onAskExit}
        style={{ alignSelf: 'stretch' }}
        faceStyle={{ minHeight: 49 }}
      >
        <KeyText>Leave to home</KeyText>
      </Key>
      <ConfirmDialog
        visible={exitOpen}
        title="Leave this round?"
        message="Your round is saved — you can resume it from the home screen."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={onConfirmExit}
        onCancel={onCancelExit}
      />
    </PaperSurface>
  )
}
