# Screenshots

Visual evidence captured by Playwright runs, organized by PR / issue.
Referenced from PR descriptions, issue comments, and bug reports via
`https://raw.githubusercontent.com/cner-smith/opengolfapp/media/screenshots/<path>`.

This directory lives only on the `media` branch — never merged into
`dev` or `main`. Periodically cleanable by force-pushing a fresh
`media` branch over the old one, or by `git rm`'ing old subdirectories
and force-pushing.

Layout:

```
screenshots/
  pr-NNN/<name>.png      Visual evidence for pull request #NNN
  issue-NNN/<name>.png   Visual evidence for issue #NNN
```

Capture tooling lives at `scripts/capture-screenshots.ts` (also on
this branch only).
