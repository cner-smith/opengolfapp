import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { LEARN_SECTIONS, readingTimeMinutes, type LearnArticle } from '@oga/core'
import { TYPE } from '../../lib/typography'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

// First three readable pieces in catalog order. Section order already
// encodes editorial priority (fundamentals first), so this surfaces the
// two flagship published articles without needing a `featured` flag or
// dates on the model. `soon` stubs aren't tappable, so they're excluded.
const FEATURED: LearnArticle[] = LEARN_SECTIONS.flatMap((s) => s.articles)
  .filter((a) => a.status !== 'soon')
  .slice(0, 3)

export function LearnPreview() {
  const router = useRouter()

  return (
    <View style={{ borderTopWidth: 2, borderColor: '#9F9580', paddingTop: 18, marginTop: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text style={[TYPE.kicker, KICKER]}>From the yardage book</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="See all Learn articles"
          onPress={() => router.push('/(app)/learn')}
          hitSlop={8}
        >
          <Text style={[TYPE.kicker, KICKER, { color: '#1F3D2C' }]}>See all →</Text>
        </Pressable>
      </View>

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
          <Text style={[TYPE.serif, { color: '#1C211C', fontSize: 16, fontStyle: 'italic', fontWeight: '500' }]}>
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
        <Text style={[TYPE.serif, { color: '#8A8B7E', fontSize: 18, fontStyle: 'italic' }]}>→</Text>
      </View>
    </Pressable>
  )
}
