# Caddie — Brand & Design System

A paper-editorial aesthetic for a golf shot-tracking app. Think *Monocle* magazine column meets Bobby Jones era yardage book. Calm, considered, opinionated.

---

## 1. The vibe in one paragraph

Caddie reads like a printed monthly column written by a coach who's been watching your game for years. Warm cream paper. Deep ink. Italic serif headlines that lean in to make a point. Mono kickers that announce sections like a magazine masthead. **One** saturated color — a deep forest green — used sparingly for accents and primary actions. No gradients, no glass, no shadows. Hairline rules instead of cards-with-shadows. Numbers and stats use serif italics so they feel hand-set, not extracted from a database.

When in doubt: **less ink, more space, longer line lengths than you think, and one decisive serif italic word per screen.**

---

## 2. Tokens

All values live in `tokens.css` and `tokens.json`. Highlights:

### Color
| Role | Hex | Usage |
|---|---|---|
| `bg` | `#F2EEE5` | Page background — warm paper, never pure white |
| `surface` | `#FBF8F1` | Cards / raised surfaces |
| `surface2` | `#EBE5D6` | Recessed / chip background |
| `line` | `#D9D2BF` | Hairline rules between sections |
| `lineStrong` | `#9F9580` | Emphasis borders |
| `ink` | `#1C211C` | Primary text, near-black with green undertone |
| `inkDim` | `#5C6356` | Secondary text |
| `inkMute` | `#8A8B7E` | Captions, kickers, metadata |
| `accent` | `#1F3D2C` | **The only saturated color.** Deep forest. CTAs, links, positive deltas |
| `neg` | `#A33A2A` | Muted brick — never bright red |
| `warn` | `#A66A1F` | Burnt amber |

**Rule:** the page contains the `accent` color in roughly 1–3 places per screen. If you find yourself reaching for a fourth, use `ink` or `inkDim` instead.

### Type
- **Serif:** Fraunces (or GT Sectra) — for ALL display, headlines, ledes, and any number that represents a quantity (score, handicap, distance). Use Italic 500 for headlines.
- **Sans:** Inter — for UI controls (buttons, inputs, navigation, table data).
- **Mono:** JetBrains Mono — for kickers (uppercase, 10px, `letter-spacing: 0.14em`) and timestamp/coordinate metadata only.

### Type scale
| Token | px | Family | Use |
|---|---|---|---|
| `display` | 38 | Serif Italic 500 | Mastheads ("Good morning, Alex.") |
| `h1` | 28 | Serif 500 | Page titles |
| `h2` | 22 | Serif 500 | Section headlines |
| `lede` | 17 | Serif 400 | Editorial body — the opinionated paragraph |
| `body` | 15 | Sans 400 | Standard UI text |
| `meta` | 13 | Sans 400 | Secondary UI / table cells |
| `kicker` | 10 | Mono 500, UPPERCASE, +0.14em | Section eyebrows |

### Radius
4px default, 2px small. **Never** more than 4px. This is paper, not plastic.

### Spacing
4 / 8 / 12 / 14 / 18 / 22 / 28. Editorial rhythm — favor 14, 18, 22 over the round numbers.

---

## 3. Voice & tone

The app **has an opinion**. It does not say "your mid-iron approach data shows -1.4 SG." It says:

> *Mid-iron approaches.* The 150–200 yd range is your biggest leak — costing you about **1.4 strokes** a round. Wedges and putting are net positive; leave them alone for now.

Voice rules:
1. **Lead with the noun, not the metric.** "Mid-iron approaches" before the number.
2. **One italic phrase per paragraph.** Use serif italic to mark the *thing being discussed*.
3. **Numbers go inline with units.** "1.4 strokes a round," not "−1.4 SG."
4. **Diagnose, then recommend.** Two sentences max per insight: what's broken, what to do.
5. **No emoji. No exclamation points. No "Great job!" cheerleading.** This is a coach, not a fitness app.
6. **Kickers are magazine sections**, not nav labels: `BY THE NUMBERS`, `WHAT TO WORK ON`, `TODAY'S FOCUS`, `RECENT ROUNDS`. Always mono, uppercase, +0.14em tracking.

---

## 4. Layout principles

- **Hairline rules, not cards.** Sections are separated by a 1px `line` border-top or border-bottom. Avoid box-shadows entirely. If you need a card, give it a 1px `line` border and `surface` background — no shadow.
- **Generous vertical rhythm.** 22–28px between sections on mobile, 18–22 on web cards.
- **Two-column grids feel like newspaper columns.** On web: `2fr 1fr` (story + sidebar) is the default. Avoid 3+ equal columns.
- **Numbers want room.** A stat tile is mostly whitespace with one big serif number. Don't crowd it with icons or sparklines.
- **No drop shadows, no glass, no gradients.** If something needs emphasis, use the `accent` color or a heavier rule.

---

## 5. Component recipes

### Kicker (the magazine eyebrow)
```css
font-family: var(--caddie-mono);
font-size: 10px;
letter-spacing: 0.14em;
text-transform: uppercase;
color: var(--caddie-ink-mute);
margin-bottom: 10px;
```

### Stat tile
- `surface` background, 1px `line` border, 4px radius, 18px padding.
- Kicker label on top.
- Number: serif, 32–38px, weight 500. If positive trend, the number stays `ink`; the **delta** below uses `pos`/`neg`.
- Delta line: 13px sans, with a `▼`/`▲` glyph in the semantic color, followed by ink text.

### Card with editorial label
- `surface` bg, 1px `line` border, 4px radius, 18px padding.
- Top of card: kicker label + (optional) right-aligned mono metadata.
- Below: a hairline `line` divider, then content.

### Primary button
- Fill: `accent`. Text: `accentInk`. 14px sans, weight 600, +0.02em tracking.
- Padding 14px 18px (mobile) / 12px 16px (web).
- 2px radius. **Never** rounded-pill.
- Optional trailing arrow: a serif italic `→` (renders thinner and more elegant than the sans glyph).

### Secondary / link button
- Transparent fill, 1px `accent` border, `accent` text.
- Same metrics as primary minus the fill.

### Diverging bar (for strokes-gained, deltas)
- Bar track: 1px `line` rule across the full width with a center tick.
- Positive bars extend right in `accent`. Negative bars extend left in `neg`.
- Number floats at the bar's end, serif italic, in the same color as the bar.
- **No rounded ends.** Rectangular bars. This is print, not iOS.

### Table / list rows
- Each row separated by 1px `line` border-bottom. No row backgrounds, no zebra striping.
- 14–16px row padding vertical.
- Date/code columns in mono, body in sans, any score/value in **serif**.

### Chips
- `chip` background, `ink` text, 2px radius, 6px 10px padding, 12px sans.
- Selected: `chipOn` (forest) bg, `accentInk` text. No outline, no shadow.

---

## 6. Do / Don't

✅ **Do**
- Use serif italic for the one word that matters most on the screen.
- Let numbers be big, alone, and serif.
- Use mono kickers like magazine section headers.
- Separate sections with hairlines.
- Keep `accent` rare — 1–3 uses per screen.
- Write copy like a coach with a column.

❌ **Don't**
- Use box-shadows, glassmorphism, or gradients.
- Use radius > 4px.
- Use bright reds, blues, or greens — the only saturated color is `#1F3D2C`.
- Use sans-serif for numbers that represent a quantity.
- Use emoji or exclamation points.
- Use icons for categories that already have a clear text label. (Icons are allowed sparingly for actions: settings, close, navigation arrows.)
- Use stock chart styling — bars are rectangles, lines are 1px, no fills under area charts.

---

## 7. Files in this handoff

| File | What it is |
|---|---|
| `BRAND.md` | This document |
| `tokens.css` | All tokens as CSS custom properties — drop into your codebase |
| `tokens.json` | Same tokens in W3C design-token JSON — for Style Dictionary / Figma plugins |

For visual reference, open the prototype project and switch the variant to **Caddie** — the Brand system tab shows mastheads, type scale, color swatches, and components in situ. The mobile and web tabs show the system in product. If something you build doesn't *feel* like that reference, it's wrong even if the tokens match.
