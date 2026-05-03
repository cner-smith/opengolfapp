# Contributing to OGA

Thanks for showing up. OGA stays free and open because contributors make
it better — drills, course data, bug fixes, design polish all welcome.

## Dev environment

Setup steps live in the [README](./README.md#self-hosting): install
dependencies, link a Supabase project, apply migrations, set env vars.
Confirm a clean baseline before touching code:

```bash
pnpm typecheck       # 4 packages must be clean
pnpm test            # Vitest, in @oga/core
pnpm --filter web build
cd apps/mobile && npm run typecheck
```

CI runs the same four commands. A PR with a red CI gate will not be
reviewed until it's green.

## Workflow

### Branching

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-feature   # or fix/, chore/
```

- Branch from `dev`, never from `main`.
- Name branches: `feature/<thing>`, `fix/<bug>`, `chore/<task>`.
- Never push directly to `main` or `dev` — both have required-status-check
  branch protection that rejects direct pushes.

### Rebasing before PR

Rebase against `origin/dev` before opening or updating a PR. Don't merge
`dev` into your branch.

```bash
git fetch origin
git rebase origin/dev
git push --force-with-lease origin <your-branch>
```

### Opening a PR

1. Push your branch.
2. Open a PR against `dev` (not `main`).
3. CI must be green before review.
4. Title in imperative present tense ("Add lie-slope filter to patterns").
5. **One concern per PR.** UI restyle, bug fix, and new feature do not
   belong in the same PR.

Maintainers periodically merge `dev → main` via PR to cut a release;
contributors don't open PRs against `main`.

## Project conventions

These rules apply across the codebase. Read them before opening a PR
that adds new code.

### Default to no, ship the minimum

Default to no. Ship the minimum that satisfies the requirement, then
stop. PRs that add scope beyond their stated concern will be asked to
split.

- No tests for getters, trivial logic, or framework behavior. Tests
  exist to catch real bugs.
- No docstrings unless the *why* is non-obvious from the name and
  types alone.
- No config vars, options, or parameters added "for hypothetical
  future use" — add them when there's a real caller.

### 3-caller rule for extraction

Don't extract a helper, hook, or component into its own function or
file unless it has three or more callers, or the inline version is
genuinely unreadable. Two similar lines are fine. Single-caller
"components" stay co-located in the parent file. If a file becomes a
merge-conflict pain point, raise it as a separate refactor issue
rather than splitting under a feature PR.

### Pure logic lives in `@oga/core`

All shared business math, stats engines, SG calculation, units
conversions, format helpers, post-round inference, and shared domain
types live in `packages/core/src/`. Web and mobile apps wire UI; they
do not own logic. Don't add helpers to `apps/web/src/lib` or
`apps/mobile/lib` that other surfaces would want to reuse — lift them
to `@oga/core`.

Any new export added to `@oga/core` must have a corresponding test.
Run `pnpm test` before opening any PR that touches `@oga/core`.

### Mobile dependency pinning

`apps/mobile` is decoupled from the pnpm workspace and uses npm with
`--legacy-peer-deps`. Mobile dependencies prefer **exact pins** over
caret/tilde ranges — EAS does fresh installs and any range bump risks
runtime version mismatches.

Notable pins:

- `nativewind` is locked at `4.1.23`. Do not bump to 4.2.x — it
  transitively pulls a worklets plugin that breaks the build.
- `react-native-worklets` is intentionally absent (different package
  from `react-native-worklets-core`, which stays).

If a mobile dep change is necessary, open a `chore/` PR for *just*
that change so the upgrade can be reverted independently if it
regresses.

### Database migrations

Numbered sequentially: `000X_descriptive_snake_case.sql`. The next
migration goes in the next free number. No date prefixes, no skipped
numbers. RLS policies must be defined for every user-owned table.

## Reporting bugs

Open a [GitHub issue](https://github.com/cner-smith/opengolfapp/issues).
Include:

- What you did, what you expected, what actually happened.
- Browser / OS / device + version (web), or Expo SDK + Android version
  (mobile).
- Console output or stack trace.
- Screenshot for any UI bug.

Reproducible steps beat lengthy descriptions every time.

## Suggesting features

Also a GitHub issue, with the `feature` label. Tell us:

- What problem you're trying to solve.
- Why the existing screens don't already cover it.
- One concrete acceptance criterion ("I can do X and see Y").

If a feature breaks one of the project's design pillars — free forever,
lie-slope-aware tracking, aim point is always explicit user input,
plans are calibrated to skill level — say why up front. That's the
highest bar.

## Adding drills (highest-leverage contribution)

The practice planner picks drills from `public.drills` in Supabase.
Adding good drills directly improves every plan generated.

Schema:

```sql
drills (
  id            uuid primary key,
  name          text,                                   -- "9-shot grid"
  description   text,                                   -- one-line summary
  duration_min  int,                                    -- realistic minutes
  category      'off_tee' | 'approach' | 'around_green' | 'putting',
  facility      text[],                                 -- ['range','short_game','putting','sim','anywhere']
  skill_levels  text[],                                 -- ['beginner','casual','developing','competitive']
  instructions  text                                    -- 1–3 sentences with concrete reps + a measurable goal
)
```

Drill checklist before submitting:

- [ ] **Category is honest.** Putting drills go in putting; chip-and-runs
      go in `around_green` even if you hit them with an iron.
- [ ] **Duration is realistic.** A drill that needs 200 balls is 30+
      minutes, not 15.
- [ ] **Facility is the actual access required.** Don't list `range`
      if it can be done at home; use `anywhere`.
- [ ] **Skill levels are appropriate.** A 9-shot shape grid is
      `developing`/`competitive` — a beginner won't get value.
- [ ] **Instructions are specific and measurable.** Bad: "practice
      your wedges". Good: "Hit 5 balls each at 50 / 75 / 100 yards.
      Track carry distance and compare to your gapping chart."

To add: drop new rows into `supabase/seed.sql` following the existing
pattern, run `npx supabase db reset` locally to verify, then PR. Title
format: `seed: add <drill-name>`.

## Course data

OGA's courses come from a one-shot crawler over OpenStreetMap +
OpenGolfAPI; see [`scripts/crawl-courses.ts`](./scripts/crawl-courses.ts).
For local development, the fastest way to get realistic course data is
a single state:

```bash
SUPABASE_URL=<your-url> \
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
  pnpm crawl:courses --source osm-first --states OK
```

Re-run with `--status` to see progress, or pass new state codes — the
crawler is resumable via the `crawl_state` table.

Bug reports for missing or wrong course data are welcome. Include the
course name, expected city/state, and what's wrong.

## Code style

- TypeScript strict everywhere. Don't add `any` to silence an error —
  fix the type.
- Prettier handles formatting (`pnpm format`). Don't argue with it.
- ESLint catches the rest (`pnpm lint`). No `// eslint-disable-next-line`
  without a comment explaining why.
- Comments only when the *why* is non-obvious from the name and types
  alone. Don't narrate what the code does.
- No emojis in source code or commit messages unless we're laying down
  user-facing copy.

## License

By contributing you agree that your contributions are licensed under
the [MIT License](./LICENSE).
