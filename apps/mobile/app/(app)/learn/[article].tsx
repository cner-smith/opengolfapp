import { Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { findLearnArticle } from '@oga/core'
import { AppBar } from '../../../components/ui/AppBar'
import { BODY, C, KICKER, TITLE } from '../../../components/learn/primitives'
import { MOBILE_ARTICLES } from '../../../components/learn/articles'
import { FONT, TYPE } from '../../../lib/typography'

export default function ArticleScreen() {
  const router = useRouter()
  const { article: slug } = useLocalSearchParams<{ article: string }>()
  const found = slug ? findLearnArticle(slug) : null

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppBar
        eyebrow={found?.section.title ?? 'Yardage book'}
        title={found?.article.title ?? 'Article'}
        right={
          <Pressable onPress={() => router.back()}>
            <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.6)', padding: 4 }}>
              ← Back
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }}>
        {!found ? (
          <NotFound />
        ) : found.article.status === 'soon' ? (
          <StubBody title={found.article.title} />
        ) : (
          <>
            {found.article.status === 'draft' && <DraftBanner />}
            <LiveArticle id={found.article.id} />
          </>
        )}
      </ScrollView>
    </View>
  )
}

/** Render the per-article component registered for this catalog id. */
function LiveArticle({ id }: { id: string }) {
  const Article = MOBILE_ARTICLES[id]
  if (Article) return <Article />
  return <StubBody title="Article" />
}

function NotFound() {
  return (
    <View>
      <Text style={TITLE}>Article not found.</Text>
      <Text style={{ ...BODY, color: C.inkDim, fontFamily: FONT.bodyItalic }}>
        That guide does not exist yet.
      </Text>
    </View>
  )
}

function DraftBanner() {
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: C.amber,
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderTopColor: C.line,
        borderRightColor: C.line,
        borderBottomColor: C.line,
        borderRadius: 2,
        backgroundColor: C.surface,
        padding: 14,
        marginBottom: 18,
      }}
    >
      <Text style={{ ...KICKER, color: C.amber, marginBottom: 6 }}>
        Work in progress
      </Text>
      <Text style={[TYPE.body, { color: C.ink, fontSize: 13, lineHeight: 19 }]}>
        This guide is being reviewed for accuracy. Treat specific technique
        advice as provisional until the notice is removed.
      </Text>
    </View>
  )
}

function StubBody({ title }: { title: string }) {
  return (
    <View>
      <Text style={{ ...KICKER, marginBottom: 10 }}>Coming soon</Text>
      <Text style={TITLE}>{title}</Text>
      <Text style={{ ...BODY, color: C.mute, fontFamily: FONT.bodyItalic }}>
        This guide is being written. Check back soon.
      </Text>
    </View>
  )
}
