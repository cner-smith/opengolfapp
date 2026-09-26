import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg'
import { P } from './tokens'

// Paper-system glyphs, lifted from the locked F6 / PR6 frames (f6.mjs /
// pr6.mjs `IC`). Stroke icons take `color`; the pin, ball and aim glyphs
// carry their own inks.
type IconProps = { size: number; color?: string }

const stroke = (color: string, w: number) => ({
  fill: 'none',
  stroke: color,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const Icon = {
  back: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 12.4H5.5M11 5.6 4.4 12.3l6.7 6.4" {...stroke(color, 1.9)} />
    </Svg>
  ),
  prev: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14.8 5.4 8.3 12l6.6 6.7" {...stroke(color, 1.9)} />
    </Svg>
  ),
  next: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9.2 5.4 15.7 12l-6.6 6.7" {...stroke(color, 1.9)} />
    </Svg>
  ),
  more: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={5} r={1.9} fill={color} />
      <Circle cx={12} cy={12} r={1.9} fill={color} />
      <Circle cx={12} cy={19} r={1.9} fill={color} />
    </Svg>
  ),
  pattern: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Ellipse cx={13} cy={13} rx={10.5} ry={7} fill="none" stroke={color} strokeWidth={1.3} strokeDasharray="2.4 2" />
      {[
        [8, 11, 1.5],
        [12.5, 9.5, 1.5],
        [17, 12, 1.5],
        [10.5, 15, 1.5],
        [15, 16, 1.5],
        [21.5, 8, 1.3],
        [4, 18, 1.3],
      ].map(([x, y, r]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={color} />
      ))}
      <Circle cx={13} cy={12.8} r={2.3} fill={color} />
    </Svg>
  ),
  // Pin-key glyph (§9): G4 flag in miniature.
  pin: ({ size, dim }: IconProps & { dim?: boolean }) => (
    <Svg width={size} height={size} viewBox="0 0 20 20" opacity={dim ? 0.4 : 1}>
      <Ellipse cx={6} cy={16.6} rx={4.4} ry={2} fill={P.ink} />
      <Path d="M1.6 16.6 A4.4 2 0 0 1 10.4 16.6" fill="none" stroke={P.chrome} strokeWidth={0.9} />
      <Rect x={5.2} y={2} width={1.6} height={14.4} fill={P.ink} />
      <Path d="M6.8 2.3 C9.5 1.6 12 3.3 17.4 2.3 L17.4 10.6 C12 11.5 9.5 9.9 6.8 10.9 Z" fill={P.neg} />
    </Svg>
  ),
  gps: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Circle cx={13} cy={13} r={7.4} {...stroke(color, 1.7)} />
      <Path d="M13 1.8v4M13 20.2v4M1.8 13h4M20.2 13h4" {...stroke(color, 1.7)} />
      <Circle cx={13} cy={13} r={3.4} fill={color} />
      <Circle cx={12} cy={12} r={0.7} fill={P.raised} />
      <Circle cx={14.1} cy={12.4} r={0.7} fill={P.raised} />
      <Circle cx={13} cy={14.2} r={0.7} fill={P.raised} />
    </Svg>
  ),
  warn: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.4 2.6 20.4h18.8z" {...stroke(color, 2)} />
      <Path d="M12 10v4.6M12 17.4v.2" {...stroke(color, 2)} />
    </Svg>
  ),
  card: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={3.5} width={16} height={17} rx={1.5} {...stroke(color, 1.6)} />
      <Path d="M4 8.5h16M9.5 8.5v12M4 13h16M4 17h16" {...stroke(color, 1.6)} />
    </Svg>
  ),
  x: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5.5 5.5l13 13M18.5 5.5l-13 13" {...stroke(color, 2)} />
    </Svg>
  ),
  share: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.5v11.5M7.5 8 12 3.5 16.5 8" {...stroke(color, 1.8)} />
      <Path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" {...stroke(color, 1.8)} />
    </Svg>
  ),
  plus: ({ size, color = P.ink }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" {...stroke(color, 2.2)} />
    </Svg>
  ),
  ball: ({ size }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={6.5} fill={P.raised} stroke={P.ink} strokeWidth={1.6} />
      <Circle cx={8.3} cy={8.6} r={0.9} fill={P.ink} />
      <Circle cx={11.7} cy={8.9} r={0.9} fill={P.ink} />
      <Circle cx={10} cy={11.8} r={0.9} fill={P.ink} />
    </Svg>
  ),
  aim: ({ size }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={5.5} {...stroke(P.ink, 1.6)} />
      <Path d="M10 1.8v3.4M10 14.8v3.4M1.8 10h3.4M14.8 10h3.4" {...stroke(P.ink, 1.6)} />
      <Circle cx={10} cy={10} r={1.4} fill={P.warn} />
    </Svg>
  ),
}
