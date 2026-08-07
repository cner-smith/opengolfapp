const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// disableHierarchicalLookup: required for the Turborepo monorepo
// layout. Without this, Metro walks up from apps/mobile and resolves
// React Native packages from the workspace root's node_modules first,
// which gets duplicate React copies and breaks the RN bridge. Pinning
// resolution to nodeModulesPaths above keeps the mobile app's own
// install authoritative. Do not remove without re-validating an EAS
// build end-to-end.
config.resolver.disableHierarchicalLookup = true

// disableHierarchicalLookup guards app/workspace source from resolving RN
// packages out of the pnpm workspace root (duplicate-React). But it also
// blocks nested node_modules copies (Reanimated 4's semver@7,
// simple-swizzle's is-arrayish, ...) that npm legitimately nests. Restore
// true Node semantics for modules ALREADY inside our own node_modules —
// walk-up from there hits apps/mobile/node_modules first, so the guard's
// protection is preserved where it matters.
const ownNodeModules = path.join(projectRoot, 'node_modules') + path.sep
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath.startsWith(ownNodeModules)) {
    return context.resolveRequest(
      { ...context, disableHierarchicalLookup: false },
      moduleName,
      platform,
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
