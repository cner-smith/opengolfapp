---
name: Feature / Enhancement
about: New capability or material improvement to an existing one
title: 'feat(<area>): <what>'
labels: feature
---

## Background
<!-- Why this exists. What user moment does it serve? What's the current state? -->

## Scope
<!-- The smallest unit that delivers value. Web-only? Mobile-only? Both? -->

## Three-system shape
| Layer | Owns |
|---|---|
| `@oga/core` | <pure helpers, types> |
| `apps/web` | <UI surfaces / "none"> |
| `apps/mobile` | <UI surfaces / "none"> |
| `supabase/` | <migration / RPC / Edge Function / "none"> |

## Data model
<!-- New tables / columns / RLS / RPCs. Migration SQL inline when concrete. -->

```sql
-- supabase/migrations/00XX_<name>.sql
-- DDL goes here when shape is known
```

## Code skeleton
<!-- TypeScript function signatures + types for the @oga/core helpers + key call sites. -->

```ts
// packages/core/src/<name>.ts
export function foo(...): ... { ... }
```

## File map
- New: `path/to/new/file.tsx`
- Update: `path/to/existing.tsx:NNN`
- Reuse: `path/to/existing-primitive.ts`

## Acceptance criteria
- [ ] Testable bullet 1
- [ ] Testable bullet 2
- [ ] Graceful degradation for <edge-case>
- [ ] No regression on <related-feature>

## Out of scope
<!-- Explicitly excluded — file separately if scope creeps. -->
- <Excluded item 1>
- <Excluded item 2>

## Dependencies
- **Depends on:** #NN (hard prereq)
- **Blocks:** #MM (this unblocks)
- **Related:** #XX (worth bundling / sequencing)

## Effort
XS / S / M / L / XL  <!-- XS=~1hr, S=~half day, M=~1-2 days, L=~3-5 days, XL=~1+ weeks -->

## Verification
<!-- How do you know it's working in prod? Manual flow, unit-test name, telemetry signal. -->
- [ ] Manual repro of golden path
- [ ] Edge cases tested: <list>
- [ ] Telemetry: <if applicable>

## Risk + rollback
<!-- For features touching auth, RLS, sync, schema, or shared state. -->
- **Risk if shipped wrong:** <impact>
- **Rollback:** <how to undo — feature flag, migration revert, etc.>

## Decision log
<!-- When picking Path A over Path B, capture the reason here so future agents
     can challenge it with full context. -->

## CLAUDE.md / project rules to preserve
<!-- Project-specific invariants the implementer must not break -->

## Cross-references
<!-- Prior art in the codebase, related PRs, external research links -->
