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

/**
 * Role-named family presets for app `<Text>`. Typeface-only: each preset sets
 * `fontFamily` and nothing else — spread it into a `<Text>`'s style and keep
 * the call site's own `fontSize` / `color` / spacing. Picking a role here is
 * how the named-weight rule is enforced: bold/italic text gets the bold/italic
 * Epilogue family, never a bare `fontWeight`.
 *
 *   <Text style={[TYPE.body, { color: C.ink, fontSize: 15 }]}>…</Text>
 */
export const TYPE = {
  /** Display / h1 / h2 headlines (Fraunces italic 500). */
  serif: { fontFamily: FONT.serifItalic },
  /** Upright serif + standalone display numbers (score, SG, distance, yards). */
  serifUpright: { fontFamily: FONT.serif },
  /** Standard UI text / body copy. */
  body: { fontFamily: FONT.body },
  /** Body at weight 600/700/'bold'. */
  bodyBold: { fontFamily: FONT.bodyBold },
  /** Italic body emphasis. */
  bodyItalic: { fontFamily: FONT.bodyItalic },
  /** Kickers + metadata/codes (hole #, par, distance, timestamps). */
  kicker: { fontFamily: FONT.mono },
} as const
