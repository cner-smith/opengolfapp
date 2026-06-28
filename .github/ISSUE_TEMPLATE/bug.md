---
name: Bug
about: A defect — something works incorrectly or worse than expected
title: '<area>: <symptom>'
labels: bug
---

**Severity:** low / medium / high / blocker
**Audit source:** <where this was found — agent, user report, code review, etc.>

## Symptom
<!-- What the user actually sees / experiences. -->

## Mechanism
<!-- Why it happens. File paths + line numbers when known. -->

- `path/to/file.ts:NNN` — what the code does today

## Three-system shape
| Layer | Owns |
|---|---|
| `@oga/core` | <pure helpers / "none"> |
| `apps/web` | <UI change site / "none"> |
| `apps/mobile` | <UI change site / "none"> |
| `supabase/` | <migration / RPC / "none"> |

## Proposed fix
<!-- The chosen approach. Brief; deep tradeoffs belong in a comment. -->

## Acceptance criteria
- [ ] Testable bullet 1
- [ ] Testable bullet 2
- [ ] No regression in <related-feature>

## Out of scope
- <Explicitly excluded items — keeps PR diffs honest>

## Dependencies
- **Depends on:** #NN (if any)
- **Blocks:** #MM (if any)
- **Related:** #XX

## Effort
XS / S / M / L / XL  <!-- XS=~1hr, S=~half day, M=~1-2 days, L=~3-5 days, XL=~1+ weeks -->

## Verification
<!-- How do we know this is fixed in prod? Manual repro, telemetry, unit-test name. -->

## Risk + rollback
<!-- Only fill in for changes that touch shared state, RLS, sync, or auth. -->

## Project rules / invariants to preserve
<!-- Anything project-specific the implementer shouldn't break -->
