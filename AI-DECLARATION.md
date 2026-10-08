---
version: 0.1.2
level: pair
processes:
  design: pair
  implementation: copilot
  testing: copilot
  documentation: copilot
  review: pair
  deployment: pair
---

# AI Declaration

This file follows the [AI-DECLARATION.md](https://ai-declaration.md/en/0.1.2/) format.

## Notes

OGA is built by its maintainer working with an AI coding assistant.

- **Decisions are human.** Product direction, design choices and trade-offs are
  decided by the maintainer, often after the assistant presents options or mockups.
- **Much of the code is AI-written, all of it human-reviewed.** The assistant
  writes most first drafts of code, tests and docs. The maintainer follows and
  reviews every change, and nothing merges without explicit approval.
- **Nothing ships without the maintainer.** Production database changes, server
  deploys and app-store releases happen only with the maintainer's go-ahead, and
  app changes are tested by hand on real devices.

### How the codebase stays healthy

AI-written or not, every change is held to the same rules, and you can check them
against the code:

- Shared domain logic (strokes gained, stats, dispersion, units) lives in one
  package, `packages/core`, and new exports there need tests.
- Ship the minimum: no speculative options, no helpers extracted until they have
  three callers, no hand-written source file over 1,000 lines.
- One concern per pull request, and CI (typecheck, tests, mobile typecheck, web
  build) must pass before review.
- Bug reports need a reproduction before a fix, and fixes are verified in the
  running app, not just by the compiler.

The full list is in [CONTRIBUTING.md](CONTRIBUTING.md#project-conventions).

### Contributions

The same standard applies to everyone: you must understand, and be able to
explain and maintain, every line you submit, however it was written. PRs that
read as unreviewed AI output will be closed.
