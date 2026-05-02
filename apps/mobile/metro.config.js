const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
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

module.exports = withNativeWind(config, { input: './global.css' })
