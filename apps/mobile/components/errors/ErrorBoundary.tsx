import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

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
  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
        }}
      >
        <View style={{ maxWidth: 480 }}>
          <Text
            style={{
              fontFamily: 'Fraunces-MediumItalic',
              fontStyle: 'italic',
              fontWeight: '500',
              fontSize: 32,
              color: '#1C211C',
              textAlign: 'center',
            }}
          >
            Something went wrong.
          </Text>
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 15,
              color: '#5C6356',
              textAlign: 'center',
              marginTop: 14,
              marginBottom: 22,
            }}
          >
            The screen hit an unexpected error. Tap below to retry.
          </Text>
          {__DEV__ && (
            <Text
              style={{
                fontFamily: 'JetBrainsMono-Regular',
                fontSize: 11,
                color: '#A33A2A',
                backgroundColor: '#FBF8F1',
                borderColor: '#D9D2BF',
                borderWidth: 1,
                borderRadius: 4,
                padding: 14,
                marginBottom: 22,
              }}
            >
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </Text>
          )}
          <Pressable
            onPress={onReset}
            style={{
              backgroundColor: '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 14,
              paddingHorizontal: 18,
              alignSelf: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter-SemiBold',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.28,
                color: '#F2EEE5',
              }}
            >
              Try again
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}
