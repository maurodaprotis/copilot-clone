import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const palettesSrc = readFileSync(
  resolve(__dirname, "../src/theme/palettes.ts"),
  "utf8",
);
const providerSrc = readFileSync(
  resolve(__dirname, "../src/theme/ThemeProvider.tsx"),
  "utf8",
);

describe("dark theme product gate", () => {
  it("ships Dark (DARK_THEME_AVAILABLE=true)", () => {
    expect(palettesSrc).toMatch(/export const DARK_THEME_AVAILABLE = true/);
  });

  it("defines a full dark palette distinct from light chrome", () => {
    expect(palettesSrc).toMatch(/bgPage: "#0B1220"/);
    expect(palettesSrc).toMatch(/bgCard: "#151C2C"/);
    expect(palettesSrc).toMatch(/textPrimary: "#E8EEF6"/);
    expect(palettesSrc).toMatch(/incomeGreen: "#34D399"/);
    expect(palettesSrc).toMatch(/overBudgetRed: "#F87171"/);
    expect(palettesSrc).toMatch(/textInverse: "#FFFFFF"/);
  });

  it("resolveThemeMode honors intentional Dark (no soft-hide)", () => {
    expect(palettesSrc).not.toMatch(/if \(!DARK_THEME_AVAILABLE\)/);
    expect(palettesSrc).toMatch(/if \(preference === "Dark"\) return "Dark"/);
  });
});

describe("dark theme DOM + atomic remap", () => {
  it("ThemeProvider paints html/body/#root and syncs RN-web atomic sheets", () => {
    expect(providerSrc).toMatch(/root\.style\.backgroundColor = palette\.bgPage/);
    expect(providerSrc).toMatch(/getElementById\("root"\)/);
    expect(providerSrc).toMatch(/syncRnWebAtomicStylesheets/);
  });

  it("exports atomic stylesheet sync for RN-web StyleSheet classes", () => {
    expect(palettesSrc).toMatch(/export function syncRnWebAtomicStylesheets/);
    expect(palettesSrc).toMatch(/export function buildAtomicColorPairs/);
    expect(palettesSrc).toMatch(/react-native-stylesheet|ATOMIC_COLOR_PROPS|insertRule/);
  });

  it("darkThemeCss forces page chrome + placeholder contrast", () => {
    expect(palettesSrc).toMatch(/#root > div/);
    expect(palettesSrc).toMatch(/input::placeholder/);
    expect(palettesSrc).toMatch(/color-scheme: dark/);
  });
});

describe("settings Appearance exposes Dark", () => {
  it("offers Light | Auto | Dark", () => {
    const settings = readFileSync(
      resolve(__dirname, "../app/settings.tsx"),
      "utf8",
    );
    expect(settings).toMatch(/options=\{\["Light", "Auto", "Dark"\]\}/);
    expect(settings).not.toMatch(/coming soon/i);
  });
});

describe("shared chrome uses useTheme (not StyleSheet-baked light navy)", () => {
  it("TxnRow / Screen / WebShell / DashboardGrid read theme at render", () => {
    const txn = readFileSync(resolve(__dirname, "../src/ui/TxnRow.tsx"), "utf8");
    const screen = readFileSync(resolve(__dirname, "../src/ui/Screen.tsx"), "utf8");
    const shell = readFileSync(resolve(__dirname, "../src/ui/WebShell.tsx"), "utf8");
    const grid = readFileSync(resolve(__dirname, "../src/ui/DashboardGrid.tsx"), "utf8");
    expect(txn).toMatch(/useTheme/);
    expect(txn).toMatch(/colors\.textPrimary/);
    expect(screen).toMatch(/backgroundColor: colors\.bgPage/);
    expect(shell).toMatch(/backgroundColor: colors\.bgPage/);
    expect(grid).toMatch(/backgroundColor: colors\.bgPage/);
  });
});

describe("dark theme rgba inline remap (Dashboard SSR)", () => {
  it("darkThemeCss matches RN-web rgba(r,g,b,1.00) style attributes", () => {
    expect(palettesSrc).toMatch(/function rgbaForms/);
    expect(palettesSrc).toMatch(/rgba\(\$\{r\},\$\{g\},\$\{b\},1\.00\)/);
    expect(palettesSrc).toMatch(/rulesForColor/);
    expect(palettesSrc).toMatch(/React Navigation DefaultTheme/);
  });

  it("ThemeProvider boots theme from storage before paint", () => {
    expect(providerSrc).toMatch(/bootThemeFromStorage/);
    expect(providerSrc).toMatch(/root\.dataset\.ccTheme !== want/);
  });
});
