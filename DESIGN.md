# OGA — Design specification

This document is the design authority for all OGA screens. Before building or modifying any UI, read this document. The goal is a consistent, purposeful interface that feels like a serious tool built for golfers — not a generic SaaS dashboard.

---

## Design direction

**Tone:** Refined utility. Like a well-made piece of golf equipment — purposeful, no wasted parts, quality that shows in the details. Not flashy, not corporate, not playful. A serious tool that respects the user's time.

**Reference aesthetic:** Dark sidebar + clean white content area. The sidebar grounds the app; the content area is where data breathes. Think Vercel, Linear, or Pitch — apps built for people who care about craft.

**The one thing to remember:** The green. `#1D9E75` is the brand. It appears on selected states, positive SG numbers, CTAs, and active nav items. Everything else is black, white, and gray. The green earns its appearance — it means something good happened, something is selected, or something needs action.

---

## Color system

### Core palette
```
--oga-black:        #111111   /* sidebar bg, primary buttons, app bar */
--oga-green:        #1D9E75   /* brand accent — selected, positive, CTA */
--oga-green-light:  #E1F5EE   /* green tint bg — selected chip bg, info cards */
--oga-green-mid:    #9FE1CB   /* green mid — progress fills, icon bg on selected */
--oga-green-dark:   #0F6E56   /* green text on light bg */
--oga-red:          #E24B4A   /* negative SG, danger, double bogey */
--oga-red-light:    #FCEBEB   /* red tint bg */
--oga-red-dark:     #A32D2D   /* red text on light bg */
--oga-amber:        #EF9F27   /* aim point, warning, caution states */
--oga-amber-light:  #FAEEDA   /* amber tint bg */
--oga-amber-dark:   #854F0B   /* amber text on light bg */
```

### Neutral palette
```
--oga-bg-page:      #F4F4F0   /* page / app background — warm off-white, not pure white */
--oga-bg-card:      #FFFFFF   /* card surfaces */
--oga-bg-input:     #F9F9F6   /* input backgrounds, secondary chips */
--oga-border:       #E4E4E0   /* card borders, dividers — warm gray */
--oga-border-dark:  #D0D0CA   /* stronger borders, hover states */
--oga-text-primary: #111111   /* primary text */
--oga-text-muted:   #888880   /* secondary text, labels, metadata */
--oga-text-hint:    #AAAAAA   /* placeholder, disabled */
```

### Semantic usage
- **Positive SG / birdie / eagle / made putt:** `--oga-green` text, `--oga-green-light` bg
- **Negative SG / bogey / double / miss:** `--oga-red` text, `--oga-red-light` bg  
- **Even / par / neutral:** `--oga-text-muted` text, no tint bg
- **Aim point / in-progress:** `--oga-amber`
- **Selected chip / active nav:** `--oga-green-light` bg, `--oga-green-dark` text, `--oga-green` border

---

## Typography

### Font stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

Inter is the right choice here — it's legible at small sizes (critical for scorecard data), has strong numeric rendering, and reads as utilitarian-professional rather than decorative.

### Scale
```
text-xs:   11px / 1.4  — labels, metadata, badge text
text-sm:   13px / 1.5  — secondary body, chip text, table cells
text-base: 15px / 1.6  — primary body text
text-lg:   18px / 1.4  — card titles, section headers
text-xl:   22px / 1.3  — page titles
text-2xl:  28px / 1.2  — metric numbers, big stats
text-3xl:  36px+       — hero numbers (handicap index on profile)
```

### Weight usage
```
font-normal (400) — body text, secondary labels
font-medium (500) — card titles, active states, metric values, button text
font-semibold (600) — page titles only
```

Never use font-bold (700) in the app UI. It reads as heavy against the refined aesthetic.

### Numeric rendering
All SG values, scores, and statistics use tabular numerals:
```css
font-variant-numeric: tabular-nums;
```
This keeps columns aligned and prevents layout shift as numbers update.

---

## Layout

### Web app shell
```
┌─────────────────────────────────────────────┐
│  Sidebar (220px, bg #111)  │  Main content  │
│                            │  (bg #F4F4F0)  │
│  Logo                      │                │
│  Nav items                 │  Page header   │
│                            │  Content area  │
│  [bottom] User + handicap  │                │
└─────────────────────────────────────────────┘
```

- Sidebar is fixed, never scrolls
- Main content area scrolls independently
- No top nav bar — sidebar handles all navigation
- Page header: page title (text-xl, font-semibold) + subtitle (text-sm, muted) — no border, just spacing

### Sidebar details
```css
background: #111111;
width: 220px;
padding: 0;
```

- Logo area: 18px/500 white text "OGA", 10px muted subtitle. Padding 18px 18px 14px. Bottom border 0.5px rgba(255,255,255,0.08)
- Section labels: 10px, rgba(255,255,255,0.3), letter-spacing 0.5px, padding 14px 12px 6px
- Nav items: 13px, rgba(255,255,255,0.5) default. Active: background rgba(29,158,117,0.2), color #5DCAA5. Padding 8px 14px. Margin 1px 8px. Border-radius 7px.
- User area: margin-top auto, border-top 0.5px rgba(255,255,255,0.08), padding 14px 14px 16px. Avatar circle 30px, green bg, white initials.

### Cards
```css
background: #FFFFFF;
border: 0.5px solid #E4E4E0;
border-radius: 10px;
padding: 12px 14px;
```

Cards sit on the `--oga-bg-page` (#F4F4F0) background. The warm off-white page bg is important — it makes white cards read as elevated without needing shadows.

No box shadows on cards. The border + background contrast does the work.

### Card labels (section headers within cards)
```css
font-size: 11px;
font-weight: 500;
color: #888880;
letter-spacing: 0.4px;
text-transform: uppercase;
margin-bottom: 8px;
```

### Metric tiles (stat summary numbers)
```css
background: #F4F4F0;  /* slightly off-white, sits inside a white card */
border-radius: 8px;
padding: 10px 12px;
```
- Label: 10px, muted, margin-bottom 3px
- Value: 18-22px, font-medium, tabular-nums
- Delta: 11px, colored green/red

### Spacing rhythm
- Between cards: 10-12px gap
- Section breaks: 16-20px
- Within cards: 8px between items, 12px between sections
- Page padding: 20px 22px

---

## Components

### Chips (selection controls)
Used for: club selector, lie type, lie slope, shot result, putt result, filters.

**Default state:**
```css
background: #F4F4F0;
border: 0.5px solid #E0E0DA;
border-radius: 7px;
padding: 7px 10px;
font-size: 12px;
color: #111111;
cursor: pointer;
```

**Selected state:**
```css
background: #E1F5EE;
border-color: #1D9E75;
color: #0F6E56;
font-weight: 500;
```

**Chip rows:** `display: flex; gap: 6px; flex-wrap: wrap;`

### Lie slope grid (3×2)
This is not a flat chip row. It is always a grid:
```
┌──────────┬──────────┬──────────┐
│  Uphill  │  Level   │ Downhill │
├──────────┼──────────┼──────────┤
│Ball above│          │Ball below│
└──────────┴──────────┴──────────┘
```
```css
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 5px;
```
The center cell of row 2 is empty — it represents "level side slope" which is already covered by "Level" in row 1. Each cell contains a small SVG icon illustrating the slope plus a text label.

### Putt result grid (2×3)
```
┌────────┬────────┬────────┐
│  Made  │ Short  │  Long  │
├────────┴┬───────┴┬───────┤
│Missed L │       │Missed R│
└─────────┴────────┴───────┘
```
Five options: Made, Short, Long, Missed left, Missed right. Rendered as a grid not a flat list.

### Score bubbles (scorecard)
```
Eagle:  filled green circle, white text
Birdie: green-light bg, green border (circle outline), green-dark text
Par:    no bg, muted text
Bogey:  red-light bg, red-dark text
Double: filled red circle, white text
Triple+: filled dark red circle, white text
```

### Buttons

**Primary (dark):**
```css
background: #111111;
color: #ffffff;
border: none;
border-radius: 10px;
padding: 13px 16px;
font-size: 13px;
font-weight: 500;
width: 100%;  /* full width in mobile/modal contexts */
```

**Primary (green) — used for positive confirmations like "Made it" on putting:**
```css
background: #1D9E75;
color: #ffffff;
/* same other properties */
```

**Secondary:**
```css
background: #ffffff;
border: 0.5px solid #E4E4E0;
color: #111111;
/* same other properties */
```

**Skip / ghost:**
```css
background: none;
border: none;
color: #AAAAAA;
font-size: 11px;
text-align: center;
```

### SG bar charts (inline, not Recharts)
For the SG breakdown bars in cards and sidebar summaries, use inline SVG or div-based bars rather than Recharts. Recharts is for trend line charts only.

Bar structure:
- Label (100px fixed width, 12px, muted)
- Track (flex:1, 7px tall, bg #F0F0EC, border-radius 4px)
- Zero line at 50% of track (1px, border color)
- Fill extends left (negative, red) or right (positive, green) from zero line
- Value (38px fixed width, 12px, font-medium, colored)

### Pill badges
```css
/* green */
background: #E1F5EE; color: #0F6E56;
/* red */  
background: #FCEBEB; color: #A32D2D;
/* amber */
background: #FAEEDA; color: #854F0B;
/* gray */
background: #F1EFE8; color: #5F5E5A;

font-size: 10-11px;
font-weight: 500;
padding: 2px 8px;
border-radius: 8px;
```

---

## Mobile-specific

### App bar
```css
background: #111111;
padding: 12px 14px 10px;
```
- Eyebrow: 10px, rgba(255,255,255,0.45), letter-spacing 0.3px
- Title: 15px, font-medium, white

### Bottom navigation
```css
background: #ffffff;
border-top: 0.5px solid #E4E4E0;
padding: 8px 0 10px;
```
- Icons: 18×18px SVG
- Labels: 9-10px
- Default: color #AAAAAA
- Active: color #1D9E75

### Page background
Same as web: `#F4F4F0` warm off-white. Not pure white, not gray.

### Bottom sheets / modals
```css
background: #ffffff;
border-radius: 16px 16px 0 0;  /* rounded top corners only */
padding: 16px 14px;
```
Handle bar at top: 32×4px, #E0E0DA, border-radius 2px, centered, margin-bottom 12px.

### Map screens
- Map fills full screen behind the UI
- Controls overlay as cards/sheets at bottom
- Distance badge: small dark pill overlay on map, bottom-right of map area
- Shot markers: 10px circles, white border 2px
  - Your ball: `#1D9E75` fill
  - Aim point: `#EF9F27` fill  
  - Previous shots: white fill, gray border
- Trajectory lines: 1.5px, white, 60% opacity, dashed (4,3)

---

## Data visualization

### Dispersion plot (shot patterns)
- Background: `#F8F8F6` (slightly warm, matches page bg)
- Grid lines: `#E8E8E4` (subtle)
- 68% cone: `rgba(29,158,117,0.15)` fill, `#1D9E75` stroke, 1px, dashed (4,3)
- 95% cone: `rgba(29,158,117,0.08)` fill, `#1D9E75` stroke, 1px, dashed (5,4), more transparent
- Shot dots: 3.5px radius
  - Solid: `#1D9E75`, 70% opacity
  - Push/pull: `#EF9F27`, 70% opacity
  - Fat/thin/shank: `#E24B4A`, 80% opacity
  - No result: `#888880`, 50% opacity
- Target point: `#1D9E75` filled circle, 3px, labeled "target" in 10px green
- Axis labels: "L", "R", "long", "short" in 9px muted text at edges

### Trend charts (Recharts)
```
Line color (SG total):     #1D9E75
Line color (off tee):      #1D9E75
Line color (approach):     #E24B4A  
Line color (around green): #EF9F27
Line color (putting):      #378ADD
Dot fill: same as line
Grid: #F0F0EC horizontal lines only, no vertical
Axis text: 11px, #888880
Tooltip: white bg, 0.5px border #E4E4E0, 10px border-radius, 11px text
```

---

## Interaction states

### Hover (web)
- Cards: no change (cards don't hover)
- Nav items: `background: rgba(255,255,255,0.05)` on dark sidebar
- Chips: `border-color: #C8C8C2` (slightly darker border)
- Buttons: 3% darker background

### Focus
- Inputs: `box-shadow: 0 0 0 2px rgba(29,158,117,0.3)` (green focus ring)
- No default browser outline

### Loading states
- Skeleton: `#F0F0EC` bg with subtle pulse animation
- Never use spinners for data that loads in <500ms
- Charts show empty state axes while data loads, not a spinner

### Empty states
- Short headline: what's missing ("No rounds logged yet")
- One line why it matters ("Log your first round to see your strokes gained breakdown")
- Single CTA button
- No illustrations — text only

---

## Design pass instructions (for the agent doing the rework)

When executing the design pass after Phase 7:

1. Read this entire document first
2. Go screen by screen in this order:
   - Web: Sidebar + AppShell → Dashboard → Rounds list → Round detail → SG page → Shot patterns → Practice plan
   - Mobile: Tab bar + navigation → Dashboard → Live round (HoleMap + ShotLogger) → Stats → Patterns → Practice
3. For each screen: check colors, typography sizes/weights, spacing, component styles against this spec. Update to match.
4. Do not redesign — match the spec. If something in the spec seems wrong, flag it rather than improvising.
5. The lie slope 3×2 grid and putt result grid must be correct on both web and mobile before anything else.
6. After each screen is reworked, verify the build still passes (`pnpm typecheck && pnpm --filter web build`).
7. Commit per screen, not all at once — easier to revert if something breaks.
