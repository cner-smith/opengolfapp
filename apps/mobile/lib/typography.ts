/**
 * Single source for mobile font families (the "Warm Editorial" type system —
 * see DESIGN.md §Typography). Each weight/style is bundled as a named `.ttf`
 * in `assets/fonts/` and registered in `app/_layout.tsx` `useFonts`.
 *
 * RN selects custom fonts by family NAME, not by `fontWeight` — once a custom
 * family is named, a bare `fontWeight` is ignored. So always set `fontFamily`
 * from this map; don't rely on weight alone.
 */
export const FONT = {
  /** Fraunces italic 500 — headlines, titles, and editorial italic emphasis. */
  serifItalic: 'Fraunces-MediumItalic',
  /** Fraunces 500 — upright serif (rare; numbers usually inherit the serif). */
  serif: 'Fraunces-Medium',
  /** Epilogue 400 — body copy and UI text. */
  body: 'Epilogue-Regular',
  /** Epilogue 700 — bold emphasis within body. */
  bodyBold: 'Epilogue-Bold',
  /** Epilogue 400 italic — italic emphasis within body. */
  bodyItalic: 'Epilogue-Italic',
  /** Inconsolata 500 — kickers, metadata, codes (the yardage-book mono). */
  mono: 'Inconsolata-Medium',
} as const
