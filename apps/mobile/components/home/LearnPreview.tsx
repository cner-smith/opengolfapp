import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { READABLE_LEARN_ARTICLES, readingTimeMinutes, type LearnArticle } from '@oga/core'
import { TYPE } from '../../lib/typography'
import { SectionHead } from '../paper/Section'
import { FONT_CAP, P } from '../paper/tokens'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

// First three readable pieces in catalog order. Section order already
// encodes editorial priority (fundamentals first), so this surfaces the
// flagship published articles without needing a `featured` flag.
const FEATURED: LearnArticle[] = READABLE_LEARN_ARTICLES.slice(0, 3)
// Surfaced on "See all" so the card reads as a library of N, not a page.
const READ_COUNT = READABLE_LEARN_ARTICLES.length

export function LearnPreview() {
  const router = useRouter()

  return (
    <View style={{ marginTop: 8 }}>
      <SectionHead
        title="From the yardage book"
        trailing={
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="See all Learn articles"
            onPress={() => router.push('/(app)/learn')}
            hitSlop={8}
          >
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.forest, fontSize: 13 }]}>
              See all {READ_COUNT} →
            </Text>
          </Pressable>
        }
      />

      {FEATURED.map((article) => (
        <PreviewRow
          key={article.id}
          article={article}
          onSelect={() =>
            router.push({
              pathname: '/(app)/learn/[article]',
              params: { article: article.id },
            })
          }
        />
      ))}
    </View>
  )
}

function PreviewRow({
  article,
  onSelect,
}: {
  article: LearnArticle
  onSelect: () => void
}) {
  const reading = readingTimeMinutes(article)
  return (
    <Pressable
      onPress={onSelect}
      style={{
        borderTopWidth: 1,
        borderColor: '#D9D2BF',
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Text style={[TYPE.serif, { color: '#1C211C', fontSize: 16 }]}>
            {article.title}
          </Text>
          {article.status === 'draft' && (
            <Text style={[TYPE.kicker, KICKER, { color: '#A66A1F', marginLeft: 8 }]}>Draft</Text>
          )}
        </View>
        <Text style={[TYPE.body, { color: '#5C6356', fontSize: 13, lineHeight: 18, marginTop: 4 }]}>
          {article.description}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {reading != null && (
          <Text style={[TYPE.kicker, KICKER, { color: '#8A8B7E', marginBottom: 4 }]}>{reading} min</Text>
        )}
        <Text style={[TYPE.serif, { color: '#8A8B7E', fontSize: 18 }]}>→</Text>
      </View>
    </Pressable>
  )
}
