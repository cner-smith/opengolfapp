import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  LEARN_SECTIONS,
  READABLE_LEARN_ARTICLES,
  readingTimeMinutes,
  type LearnArticle,
  type LearnSection,
} from '@oga/core'
import { AppBar } from '../../../components/ui/AppBar'
import { KICKER } from '../../../components/learn/primitives'
import { PaperSurface } from '../../../components/paper/Paper'
import { SectionHead } from '../../../components/paper/Section'
import { FONT, TYPE } from '../../../lib/typography'
import { FONT_CAP, P } from '../../../components/paper/tokens'

// The dark AppBar keeps its mono-caps back link.
const BACK: import('react-native').TextStyle = {
  fontFamily: FONT.mono,
  color: 'rgba(242,238,229,0.6)',
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  padding: 4,
}

// Library-signal counts — static (derived from the @oga/core catalog), so
// they live at module scope rather than re-deriving each render.
const ARTICLE_COUNT = READABLE_LEARN_ARTICLES.length
const SECTION_COUNT = LEARN_SECTIONS.length

export default function LearnScreen() {
  const router = useRouter()

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar
        eyebrow="Yardage book"
        title="Learn"
        right={
          <Pressable onPress={() => router.back()}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={BACK}>
              ← Back
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }}>
        <Text
          maxFontSizeMultiplier={FONT_CAP}
          style={[TYPE.serif, {
            color: P.ink,
            fontSize: 22,
            lineHeight: 28,
            marginBottom: 8,
          }]}
        >
          A coach's column on the stats this app tracks.
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14, lineHeight: 20 }]}>
          What they mean, why they matter, and what the numbers look like across
          the field.
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...KICKER, marginTop: 14 }}>
          {ARTICLE_COUNT} short reads · {SECTION_COUNT} section
          {SECTION_COUNT === 1 ? '' : 's'}
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
    </PaperSurface>
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
  const titleColor = isSoon ? P.inkDim : P.ink

  return (
    <Pressable
      onPress={() => (isSoon ? null : onSelect(article))}
      disabled={isSoon}
      style={{
        borderTopWidth: 1,
        borderColor: P.line,
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
            maxFontSizeMultiplier={FONT_CAP}
            style={[TYPE.serif, {
              color: titleColor,
              fontSize: 17,
            }]}
          >
            {article.title}
          </Text>
          {isDraft && (
            <Text
              maxFontSizeMultiplier={FONT_CAP}
              style={{ ...KICKER, color: P.warn, marginLeft: 8 }}
            >
              Draft
            </Text>
          )}
        </View>
        <Text
          maxFontSizeMultiplier={FONT_CAP}
          style={[TYPE.body, {
            color: P.inkDim,
            fontSize: 13,
            lineHeight: 18,
            marginTop: 4,
          }]}
        >
          {article.description}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {isSoon ? (
          <Text maxFontSizeMultiplier={FONT_CAP} style={KICKER}>Soon</Text>
        ) : (
          <>
            {reading != null && (
              <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...KICKER, marginBottom: 4 }}>
                {reading} min
              </Text>
            )}
            <Text
              maxFontSizeMultiplier={FONT_CAP}
              style={[TYPE.serif, { color: P.inkDim, fontSize: 18 }]}
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
    <View style={{ marginTop: 28 }}>
      <SectionHead
        title={section.title}
        trailing={
          <Text maxFontSizeMultiplier={FONT_CAP} style={KICKER}>
            {section.number}
          </Text>
        }
      />
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
