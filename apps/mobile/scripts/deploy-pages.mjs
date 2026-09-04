#!/usr/bin/env node
/**
 * Export Expo web (static) and deploy to Cloudflare Pages project `copilot-clone`.
 * Requires CLOUDFLARE_API_TOKEN (+ optional CLOUDFLARE_ACCOUNT_ID).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "../..");
const outDir = path.join(mobileRoot, "dist-web");
const wranglerJs = path.join(
  repoRoot,
  "apps/api/node_modules/wrangler/bin/wrangler.js",
);
const expoCli = path.join(mobileRoot, "node_modules/expo/bin/cli");

const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID || "005a2bd41e7a63f88c945fd6fb7ba6a0";

function run(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: accountId,
      EXPO_PUBLIC_API_URL:
        process.env.EXPO_PUBLIC_API_URL ||
        "https://copilot-clone-api.maurodaprotis.workers.dev",
    },
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run(process.execPath, [expoCli, "export", "--platform", "web", "--output-dir", "dist-web"], mobileRoot);
run(
  process.execPath,
  [
    wranglerJs,
    "pages",
    "deploy",
    outDir,
    "--project-name=copilot-clone",
    "--branch=main",
    "--commit-dirty=true",
  ],
  repoRoot,
);
console.log("Deployed: https://copilot-clone.pages.dev");
