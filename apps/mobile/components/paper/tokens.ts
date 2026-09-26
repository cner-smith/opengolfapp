// #611 "paper" system (LOCKED-SPEC §0–§1). Square (radius 3), hard ink
// ledges under everything pressable, grain on opaque paper, translucent
// "glass" only on the two map plates.
export const P = {
  chrome: '#F2EEE5',
  raised: '#FBF8F1',
  glass: 'rgba(251,248,241,0.68)',
  well: '#E4DCCA',
  ink: '#1C211C',
  inkDim: '#5C6356',
  ink85: 'rgba(28,33,28,.85)',
  ink45: 'rgba(28,33,28,.45)',
  ink35: 'rgba(28,33,28,.35)',
  line: '#D9D2BF',
  lineStrong: '#9F9580',
  forest: '#1F3D2C',
  forestEdge: '#0C1A12',
  forestPressed: '#183224',
  brass: '#C9A24E',
  brassEdge: '#7A5F24',
  warn: '#A66A1F',
  neg: '#A33A2A',
  negEdge: '#6E2418',
  scrim: 'rgba(28,33,28,.48)',
  tagShadow: 'rgba(28,33,28,.55)',
  shade: 'rgba(28,33,28,.28)',
} as const

export const R = 3
export const LEDGE = 3
export const MARGIN = 12
export const GAP = 8
