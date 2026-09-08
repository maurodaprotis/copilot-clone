#!/usr/bin/env node
/**
 * Export Expo web (static) and deploy to Cloudflare Pages project `copilot-clone`.
 * Requires CLOUDFLARE_API_TOKEN (+ optional CLOUDFLARE_ACCOUNT_ID).
 */
import { spawnSync } from "node:child_process";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
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

const THEME_BOOT = `<script id="copilot-theme-boot">(function(){try{var k='copilot-theme-mode';var m=localStorage.getItem(k);var dark=m==='Dark'||(m!=='Light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(!dark)return;var d=document.documentElement;d.dataset.ccTheme='dark';d.style.backgroundColor='#0B1220';d.style.colorScheme='dark';var s=document.createElement('style');s.id='copilot-theme-boot-css';s.textContent='html[data-cc-theme=dark],html[data-cc-theme=dark] body,html[data-cc-theme=dark] #root{background-color:#0B1220!important;color-scheme:dark}html[data-cc-theme=dark] #root [style*="background-color:rgba(255,255,255,1.00)"],html[data-cc-theme=dark] #root [style*="background-color: rgb(255, 255, 255)"]{background-color:#151C2C!important}html[data-cc-theme=dark] #root [style*="background-color:rgba(242,244,247,1.00)"],html[data-cc-theme=dark] #root [style*="background-color:rgba(242,242,242,1.00)"]{background-color:#0B1220!important}';document.head.appendChild(s);}catch(e){}})();</script>`;

function injectThemeBoot(dir) {
  const stack = [dir];
  let n = 0;
  while (stack.length) {
    const cur = stack.pop();
    for (const name of readdirSync(cur)) {
      const p = path.join(cur, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (name !== "index.html") continue;
      let html = readFileSync(p, "utf8");
      if (html.includes("copilot-theme-boot")) continue;
      if (html.includes("<head>")) html = html.replace("<head>", "<head>" + THEME_BOOT);
      else if (/<head[\s>]/.test(html)) html = html.replace(/<head([^>]*)>/, "<head$1>" + THEME_BOOT);
      else continue;
      writeFileSync(p, html);
      n++;
    }
  }
  console.log(`injectThemeBoot: patched ${n} index.html files`);
}

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
injectThemeBoot(outDir);
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
