import type { TextStyle } from 'react-native'
import { FONT, TYPE } from '../../../lib/typography'
import { P, R } from '../../paper/tokens'

// Small sentence-case meta line (screen eyebrow, attribution).
export const META: TextStyle = { ...TYPE.body, color: P.inkDim, fontSize: 12 }

export const inputStyle = {
  backgroundColor: P.raised,
  borderWidth: 1,
  borderColor: P.ink,
  borderRadius: R,
  paddingHorizontal: 12,
  paddingVertical: 12,
  fontSize: 15,
  color: P.ink,
  fontFamily: FONT.body,
} as const
