import type { TextStyle } from "react-native";
import { Platform } from "react-native";
import { colors as lightColors, fontFamily, type as lightType } from "./tokens";

export type ColorPalette = { readonly [K in keyof typeof lightColors]: string };

export const lightPalette: ColorPalette = { ...lightColors };

/** Copilot-like dark surfaces for Settings → Theme Dark. */
export const darkPalette: ColorPalette = {
  ...lightColors,
  bgPage: "#0B1220",
  bgCard: "#151C2C",
  bgElevated: "#1A2336",
  bgMuted: "#1E293B",
  bgInput: "#111827",
  bgModalScrim: "rgba(0, 0, 0, 0.55)",
  bgSelection: "#0F3D32",
  bgSelectionBar: "#3B82F6",
  bgSidebarActive: "#1E3A5F",
  textPrimary: "#E8EEF6",
  textSecondary: "#9AA8BC",
  textTertiary: "#7B879C",
  textInverse: "#0B1220",
  textLink: "#93C5FD",
  borderSubtle: "#2A3548",
  borderHairline: "#1F2A3D",
  divider: "#243044",
  accentBlue: "#60A5FA",
  accentBlueSoft: "#1E3A5F",
  incomeGreen: "#34D399",
  incomeGreenText: "#6EE7B7",
  incomeGreenBg: "#064E3B",
  overBudgetRed: "#F87171",
  overBudgetRedSoft: "#7F1D1D",
  overBudgetCallout: "#FB7185",
  debtOrange: "#FBBF24",
  debtOrangeDot: "#F59E0B",
  assetBlue: "#60A5FA",
  assetBlueDot: "#93C5FD",
  chartBudgetLine: "#6B7280",
  chartSpendLine: "#FB7185",
  chartDashGreen: "#34D399",
  tabActive: "#60A5FA",
  tabInactive: "#7B879C",
  toggleOn: "#3B82F6",
  toggleOff: "#4B5563",
  segmentActiveBg: "#E5E7EB",
  segmentActiveText: "#111827",
  segmentInactiveBg: "transparent",
  segmentTrackBg: "#1E293B",
  pillBg: "#1E293B",
  pillText: "#CBD5E1",
  categoryPillBg: "#1E293B",
  sparkleBlue: "#60A5FA",
  sparkleHalo: "rgba(96, 165, 250, 0.25)",
  progressTrack: "#1F2A3D",
  progressFill: "#E8EEF6",
  danger: "#F87171",
  warning: "#FBBF24",
  success: "#34D399",
  bg: "#0B1220",
  card: "#151C2C",
  text: "#E8EEF6",
  primary: "#60A5FA",
  primarySoft: "#1E3A5F",
  primaryPressed: "#3B82F6",
  accent: "#60A5FA",
  navy: "#E8EEF6",
  income: "#34D399",
  spend: "#E8EEF6",
  chipBg: "#1E293B",
  chipOn: "#E8EEF6",
  border: "#2A3548",
  overlay: "rgba(0, 0, 0, 0.55)",
  shadow: "rgba(0, 0, 0, 0.35)",
};

export type ThemeMode = "Light" | "Auto" | "Dark";

export function resolveThemeMode(
  preference: ThemeMode,
  systemDark: boolean,
): "Light" | "Dark" {
  if (preference === "Light") return "Light";
  if (preference === "Dark") return "Dark";
  return systemDark ? "Dark" : "Light";
}

export function paletteFor(mode: "Light" | "Dark"): ColorPalette {
  return mode === "Dark" ? darkPalette : lightPalette;
}

export function buildType(palette: ColorPalette): typeof lightType {
  const base = lightType as Record<string, TextStyle>;
  const out: Record<string, TextStyle> = {};
  for (const [key, style] of Object.entries(base)) {
    const color =
      key === "subhead" || key === "footnote" || key === "sectionLabel" || key === "caption" || key === "tabLabel"
        ? key === "tabLabel" || key === "sectionLabel" || key === "caption"
          ? palette.textTertiary
          : palette.textSecondary
        : palette.textPrimary;
    out[key] = { ...style, color, fontFamily };
  }
  return out as typeof lightType;
}

/** Web: force dark surfaces over RN-web inline light tokens. */
export function darkThemeCss(): string {
  const d = darkPalette;
  return `
html[data-cc-theme="dark"] body,
html[data-cc-theme="dark"] #root {
  background-color: ${d.bgPage} !important;
  color: ${d.textPrimary} !important;
  color-scheme: dark;
}
html[data-cc-theme="dark"] #root [style*="background-color: rgb(242, 244, 247)"],
html[data-cc-theme="dark"] #root [style*="background-color:rgb(242, 244, 247)"] {
  background-color: ${d.bgPage} !important;
}
html[data-cc-theme="dark"] #root [style*="background-color: rgb(255, 255, 255)"],
html[data-cc-theme="dark"] #root [style*="background-color:rgb(255, 255, 255)"] {
  background-color: ${d.bgCard} !important;
}
html[data-cc-theme="dark"] #root [style*="background-color: rgb(238, 241, 245)"],
html[data-cc-theme="dark"] #root [style*="background-color:rgb(238, 241, 245)"] {
  background-color: ${d.bgMuted} !important;
}
html[data-cc-theme="dark"] #root [style*="background-color: rgb(247, 248, 250)"],
html[data-cc-theme="dark"] #root [style*="background-color:rgb(247, 248, 250)"] {
  background-color: ${d.bgInput} !important;
}
html[data-cc-theme="dark"] #root [style*="background-color: rgb(235, 242, 255)"],
html[data-cc-theme="dark"] #root [style*="background-color:rgb(235, 242, 255)"] {
  background-color: ${d.accentBlueSoft} !important;
}
html[data-cc-theme="dark"] #root [style*="color: rgb(27, 43, 75)"],
html[data-cc-theme="dark"] #root [style*="color:rgb(27, 43, 75)"] {
  color: ${d.textPrimary} !important;
}
html[data-cc-theme="dark"] #root [style*="color: rgb(107, 122, 144)"],
html[data-cc-theme="dark"] #root [style*="color:rgb(107, 122, 144)"] {
  color: ${d.textSecondary} !important;
}
html[data-cc-theme="dark"] #root [style*="color: rgb(138, 148, 166)"],
html[data-cc-theme="dark"] #root [style*="color:rgb(138, 148, 166)"] {
  color: ${d.textTertiary} !important;
}
html[data-cc-theme="dark"] #root [style*="border-color: rgb(229, 231, 235)"],
html[data-cc-theme="dark"] #root [style*="border-color:rgb(229, 231, 235)"] {
  border-color: ${d.borderSubtle} !important;
}
`.trim();
}
