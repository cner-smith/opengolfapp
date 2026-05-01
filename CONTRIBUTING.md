# Contributing to OGA

Thanks for showing up. OGA stays free and open because contributors make it better — drills, course data, bug fixes, design polish all welcome.

## Dev environment

See the [Quick start](./README.md#quick-start) in the README for the full sequence (`supabase start`, `pnpm install`, `pnpm dev --filter web`). Make sure `pnpm typecheck` and `pnpm test` both pass before you start touching code so you have a clean baseline.

## Development workflow

### Branching
- Branch from dev: `git checkout dev && git pull && git checkout -b feature/your-feature`
- Name branches: `feature/thing`, `fix/bug-name`, `chore/cleanup`
- Never push directly to main or dev

### Opening a PR
1. Push your branch
2. Open a PR against `dev` (not main)
3. Fill out the PR template
4. CI must pass before merging

### Releases
Maintainers periodically merge dev → main to cut a release.

## Reporting bugs

Open a [GitHub issue](https://github.com/cner-smith/opengolfapp/issues). Include:

- What you did, what you expected, what actually happened.
- Browser / OS / device + version (web), or Expo SDK + Android version (mobile).
- Console output or stack trace if there is one.
- Screenshot for any UI bug.

Reproducible steps beat lengthy descriptions every time.

## Suggesting features

Also a GitHub issue, with the `feature` label. Tell us:

- What problem you're trying to solve.
- Why the existing screens don't already cover it.
- One concrete acceptance criterion ("I can do X and see Y").

If a feature breaks one of the project's design pillars — free forever, lie-slope-aware tracking, aim point is always explicit user input, plans are calibrated to skill level — say why up front. That's the highest bar.

## Pull request process

1. Branch off `main` (`git checkout -b your-handle/short-description`).
2. Make the change. **One concern per PR** — UI restyle, bug fix, and new feature do not belong in the same PR.
3. Run the local gates:
   ```bash
   pnpm typecheck       # 4 packages, must be clean
   pnpm test            # 31 tests in @oga/core
   pnpm lint            # eslint over web + packages
   pnpm format          # prettier
   ```
4. Push, open the PR. Title in imperative present tense ("Add lie-slope filter to patterns").
5. CI must be green. Reviewer will check that the PR stays minimum-scope — see the code style notes below.

## Adding drills (the highest-leverage contribution)

The AI practice planner picks from `public.drills` in Supabase. **Adding good drills directly improves the plans every user gets.**

The schema:

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

- [ ] **Category is honest.** Putting drills go in putting; chip-and-runs go in around_green even if you hit them with an iron.
- [ ] **Duration is realistic.** A drill that needs 200 balls is 30+ minutes, not 15.
- [ ] **Facility is the actual access required.** Don't list `range` if it can be done at home; use `anywhere`.
- [ ] **Skill levels are appropriate.** A 9-shot shape grid is `developing`/`competitive` — a beginner won't get value.
- [ ] **Instructions are specific and measurable.** Bad: "practice your wedges". Good: "Hit 5 balls each at 50 / 75 / 100 yards. Track carry distance and compare to your gapping chart."

To add: drop new rows into `supabase/seed.sql` following the existing pattern, run `npx supabase db reset` locally to verify, then PR. Title format: `seed: add <drill-name>`.

## Code style

- TypeScript strict everywhere. Don't add `any` to silence an error — fix the type.
- Prettier handles formatting (`pnpm format`). Don't argue with it.
- ESLint catches the rest (`pnpm lint`). Don't add `// eslint-disable-next-line` without a comment explaining why.
- Comments only when the **why** is non-obvious from the name and types alone. Don't narrate what the code does.
- No emojis in source code or commit messages unless we're laying down user-facing copy.

Default to no. Ship the minimum that satisfies the requirement. Don't extract a helper unless it has three or more callers. Don't add config vars, options, or parameters for hypothetical future use. PRs that add scope beyond their stated concern will be asked to split.

## License

By contributing you agree that your contributions are licensed under the [MIT License](./LICENSE).
