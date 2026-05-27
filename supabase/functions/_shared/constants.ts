// Vendored shim: the `_shared/practice-plan/*` copies import these TYPES from
// '../constants'. Type-only imports are erased at runtime; this file exists so
// the copies type-resolve in the Edge Function without pulling all of @oga/core.
// Keep in sync with packages/core/src/constants.ts (SKILL_LEVELS / GOALS).
export type SkillLevel = 'beginner' | 'casual' | 'developing' | 'competitive'
export type Goal = 'break_100' | 'break_90' | 'break_80' | 'break_70s' | 'scratch'
