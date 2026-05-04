import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppBar } from '../../../components/ui/AppBar'
import {
  LEARN_SECTIONS,
  type ArticleStub,
  type LearnSection,
} from '../../../components/learn/sections'

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
            onSelect={(article) => router.push(`/(app)/learn/${article.id}`)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function SectionBlock({
  section,
  onSelect,
}: {
  section: LearnSection
  onSelect: (article: ArticleStub) => void
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
          <Pressable
            key={article.id}
            onPress={() => onSelect(article)}
            style={{
              borderTopWidth: 1,
              borderColor: '#D9D2BF',
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                flex: 1,
                color: article.status === 'stub' ? '#5C6356' : '#1C211C',
                fontSize: 17,
                fontStyle: 'italic',
                fontWeight: '500',
              }}
            >
              {article.title}
            </Text>
            {article.status === 'stub' ? (
              <Text style={{ ...KICKER, color: '#8A8B7E', marginLeft: 12 }}>
                Soon
              </Text>
            ) : (
              <Text
                style={{
                  color: '#8A8B7E',
                  fontSize: 18,
                  fontStyle: 'italic',
                  marginLeft: 12,
                }}
              >
                →
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  )
}
