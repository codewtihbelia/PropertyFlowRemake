const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");
const localSharedPath = path.resolve(projectRoot, "src/shared");
const monorepoSharedPath = path.resolve(monorepoRoot, "packages/shared/src");

const config = getDefaultConfig(projectRoot);

const resolvedSharedPath = fs.existsSync(localSharedPath)
  ? localSharedPath
  : monorepoSharedPath;

// Support both monorepo builds and standalone /packages/mobile builds on EAS
if (fs.existsSync(path.join(monorepoRoot, "packages", "shared"))) {
  config.watchFolders = [monorepoRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
  ];
} else {
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
  ];
}

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@propertyflow/shared": resolvedSharedPath,
  "@splitzy/shared": resolvedSharedPath,
};

module.exports = config;
