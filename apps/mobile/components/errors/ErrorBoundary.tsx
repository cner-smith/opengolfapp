import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../paper/Paper'
import { PaperTile } from '../paper/Section'
import { FONT_CAP, P } from '../paper/tokens'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught:', error, info)
    }
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorScreen
          error={this.state.error}
          onReset={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}

function ErrorScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  // Clear of the status bar / nav bar (edge-to-edge): the title sat under it.
  const insets = useSafeAreaInsets()
  return (
    <PaperSurface style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 28,
        }}
      >
        <View style={{ maxWidth: 480 }}>
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            style={[TYPE.serif, {
              fontSize: 32,
              lineHeight: 40,
              color: P.ink,
              textAlign: 'center',
            }]}
          >
            Something went wrong.
          </Text>
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            style={[TYPE.body, {
              fontSize: 15,
              lineHeight: 21,
              color: P.inkDim,
              textAlign: 'center',
              marginTop: 14,
              marginBottom: 22,
            }]}
          >
            The screen hit an unexpected error. Tap below to retry.
          </Text>
          {__DEV__ && (
            <PaperTile style={{ marginBottom: 22 }}>
              <Text numberOfLines={14} maxFontSizeMultiplier={FONT_CAP} style={[TYPE.kicker, { fontSize: 11, color: P.neg }]}>
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </Text>
            </PaperTile>
          )}
          <Key
            tone="primary"
            accessibilityLabel="Try again"
            onPress={onReset}
            style={{ alignSelf: 'center' }}
            faceStyle={{ minHeight: 48, paddingHorizontal: 22 }}
          >
            <KeyText tone="primary" bold size={15}>
              Try again
            </KeyText>
          </Key>
        </View>
      </ScrollView>
    </PaperSurface>
  )
}
