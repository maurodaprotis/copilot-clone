import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const palettesSrc = readFileSync(
  resolve(__dirname, "../src/theme/palettes.ts"),
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
