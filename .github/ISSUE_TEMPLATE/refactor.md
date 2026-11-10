---
name: Refactor / Chore
about: Non-functional improvement — moving code, type hygiene, infra
title: 'refactor(<area>): <what>'
labels: refactor
---

## Motivation
<!-- Why now? What gets unblocked / cleaner / safer? -->

## Current state
- `path/to/file.ts:NNN` — what's there today

## Target state
<!-- The shape after the refactor. -->

## Three-system shape
| Layer | Owns |
|---|---|
| `@oga/core` | <if logic moves here> |
| `apps/web` | <change site / "none"> |
| `apps/mobile` | <change site / "none"> |
| `supabase/` | <migration / "none"> |

## Acceptance criteria
- [ ] No behavior change (same tests pass)
- [ ] New file/structure in place
- [ ] Old code removed (no dead exports)
- [ ] Imports updated across callers

## Out of scope
- <Behavior changes that should land separately>

## Dependencies
- **Depends on:** #NN
- **Blocks:** #MM

## Effort
XS / S / M / L / XL

## Verification
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passes
- [ ] No new lint warnings

## Project rules / invariants to preserve
- Function design (CONTRIBUTING.md): honest core, thin shell; a new file needs 3+ callers or the 1,000-line cap
