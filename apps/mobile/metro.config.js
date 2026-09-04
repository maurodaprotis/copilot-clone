const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Domain/db packages use NodeNext-style `./foo.js` imports that map to `./foo.ts`.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    typeof moduleName === "string" &&
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js")
  ) {
    const asTs = moduleName.slice(0, -3) + ".ts";
    try {
      return context.resolveRequest(context, asTs, platform);
    } catch {
      // fall through to default
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
