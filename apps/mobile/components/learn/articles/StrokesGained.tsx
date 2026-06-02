import { View } from 'react-native'
import { ArticleHeader, P, Subhead } from '../primitives'

export function StrokesGainedArticle() {
  return (
    <View>
      <ArticleHeader kicker="Strokes gained" title="Where strokes come from." />
      <P>
        Every shot is graded against an expected outcome at your handicap. Beat
        the expectation, you gain strokes; come up short, you lose them. Sum
        across a round and you find out which part of the game is paying you
        and which is leaking. Score alone tells you the result; SG tells you
        why.
      </P>

      <Subhead>The four categories</Subhead>
      <P>
        Off tee = par-4 and par-5 tee shots. Approach = anything outside 30 yd
        that is not a tee shot. Around the green = inside 30 yd, not on the
        green. Putting = every shot on the green.
      </P>
    </View>
  )
}
