import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  LEARN_SECTIONS,
  readingTimeMinutes,
  type LearnArticle,
  type LearnSection,
} from '@oga/core'
import { AppBar } from '../../../components/ui/AppBar'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export default function LearnScreen() {
  const router = useRouter()

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar
        eyebrow="Yardage book"
        title="Learn"
        right={
          <Pressable onPress={() => router.back()}>
            <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.6)', padding: 4 }}>
              ← Back
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }}>
        <Text
          style={{
            color: '#1C211C',
            fontSize: 22,
            fontStyle: 'italic',
            fontWeight: '500',
            lineHeight: 28,
            marginBottom: 8,
          }}
        >
          A coach's column on the stats this app tracks.
        </Text>
        <Text style={{ color: '#5C6356', fontSize: 14, lineHeight: 20 }}>
          What they mean, why they matter, and what the numbers look like across
          the field.
        </Text>

        {LEARN_SECTIONS.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            onSelect={(article) =>
              router.push({ pathname: '/(app)/learn/[article]', params: { article: article.id } })
            }
          />
        ))}
      </ScrollView>
    </View>
  )
}

function ArticleRow({
  article,
  onSelect,
}: {
  article: LearnArticle
  onSelect: (article: LearnArticle) => void
}) {
  const isSoon = article.status === 'soon'
  const isDraft = article.status === 'draft'
  const reading = readingTimeMinutes(article)
  const titleColor = isSoon ? '#5C6356' : '#1C211C'

  return (
    <Pressable
      onPress={() => (isSoon ? null : onSelect(article))}
      disabled={isSoon}
      style={{
        borderTopWidth: 1,
        borderColor: '#D9D2BF',
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            flexWrap: 'wrap',
          }}
        >
          <Text
            style={{
              color: titleColor,
              fontSize: 17,
              fontStyle: 'italic',
              fontWeight: '500',
            }}
          >
            {article.title}
          </Text>
          {isDraft && (
            <Text
              style={{ ...KICKER, color: '#A66A1F', marginLeft: 8 }}
            >
              Draft
            </Text>
          )}
        </View>
        <Text
          style={{
            color: '#5C6356',
            fontSize: 13,
            lineHeight: 18,
            marginTop: 4,
          }}
        >
          {article.description}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {isSoon ? (
          <Text style={{ ...KICKER, color: '#8A8B7E' }}>Soon</Text>
        ) : (
          <>
            {reading != null && (
              <Text style={{ ...KICKER, color: '#8A8B7E', marginBottom: 4 }}>
                {reading} min
              </Text>
            )}
            <Text
              style={{ color: '#8A8B7E', fontSize: 18, fontStyle: 'italic' }}
            >
              →
            </Text>
          </>
        )}
      </View>
    </Pressable>
  )
}

function SectionBlock({
  section,
  onSelect,
}: {
  section: LearnSection
  onSelect: (article: LearnArticle) => void
}) {
  return (
    <View
      style={{
        borderTopWidth: 2,
        borderColor: '#9F9580',
        paddingTop: 22,
        marginTop: 28,
      }}
    >
      <Text style={{ ...KICKER, marginBottom: 8 }}>{section.number}</Text>
      <Text
        style={{
          color: '#1C211C',
          fontSize: 24,
          fontStyle: 'italic',
          fontWeight: '500',
          lineHeight: 30,
          marginBottom: 14,
        }}
      >
        {section.title}
      </Text>
      <View>
        {section.articles.map((article) => (
          <ArticleRow
            key={article.id}
            article={article}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  )
}
