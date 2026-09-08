import type { TextStyle } from "react-native";
import { colors as lightColors, fontFamily, type as lightType } from "./tokens";

export type ColorPalette = { readonly [K in keyof typeof lightColors]: string };

export const lightPalette: ColorPalette = { ...lightColors };

/**
 * Copilot-like dark surfaces — intentional full theme (not soft-hide).
 * Contrast targets: page/cards/sidebar/tabs/modals/tables readable end-to-end.
 */
export const darkPalette: ColorPalette = {
  ...lightColors,
  bgPage: "#0B1220",
  bgCard: "#151C2C",
  bgElevated: "#1A2336",
  bgMuted: "#1E293B",
  bgInput: "#111827",
  bgModalScrim: "rgba(0, 0, 0, 0.62)",
  bgSelection: "#0F3D32",
  bgSelectionBar: "#3B82F6",
  bgSidebarActive: "#1E3A5F",
  textPrimary: "#E8EEF6",
  textSecondary: "#9AA8BC",
  textTertiary: "#7B879C",
  // Stay white on accent/filled buttons (do not invert).
  textInverse: "#FFFFFF",
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
  // Time-range segment: light chip on dark track
  segmentActiveBg: "#E5E7EB",
  segmentActiveText: "#111827",
  segmentInactiveBg: "transparent",
  segmentTrackBg: "#1E293B",
  pillBg: "#1E293B",
  pillText: "#CBD5E1",
  categoryPillBg: "#1E293B",
  sparkleBlue: "#60A5FA",
  sparkleHalo: "rgba(96, 165, 250, 0.28)",
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
  overlay: "rgba(0, 0, 0, 0.62)",
  shadow: "rgba(0, 0, 0, 0.45)",
};

export type ThemeMode = "Light" | "Auto" | "Dark";

/** Full Dark is a shipped product feature (Appearance Light | Auto | Dark). */
export const DARK_THEME_AVAILABLE = true;

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

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbCss({ r, g, b }: { r: number; g: number; b: number }): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbCssCompact({ r, g, b }: { r: number; g: number; b: number }): string {
  return `rgb(${r},${g},${b})`;
}

type PropKind = "background-color" | "color" | "border-color";

function rule(prop: PropKind, from: string, to: string): string {
  return `html[data-cc-theme="dark"] #root [style*="${prop}: ${from}"],\nhtml[data-cc-theme="dark"] #root [style*="${prop}:${from}"] {\n  ${prop}: ${to} !important;\n}`;
}

/**
 * Web: remap RN-web inline light tokens baked by StyleSheet.create.
 * background remaps include white→card; color remaps skip pure white (inverse text).
 */
export function darkThemeCss(): string {
  const d = darkPalette;
  const l = lightPalette;
  const chunks: string[] = [
    `html[data-cc-theme="dark"] body,
html[data-cc-theme="dark"] #root {
  background-color: ${d.bgPage} !important;
  color: ${d.textPrimary} !important;
  color-scheme: dark;
}`,
  ];

  const seenBg = new Set<string>();
  const seenFg = new Set<string>();
  const seenBorder = new Set<string>();

  const addHexPair = (
    kind: PropKind,
    lightHex: string,
    darkHex: string,
    seen: Set<string>,
  ) => {
    if (lightHex === darkHex) return;
    const from = parseHex(lightHex);
    const to = parseHex(darkHex);
    if (!from || !to) return;
    const key = `${from.r},${from.g},${from.b}`;
    if (seen.has(key)) return;
    seen.add(key);
    const toHex = darkHex;
    chunks.push(rule(kind, rgbCss(from), toHex));
    chunks.push(rule(kind, rgbCssCompact(from), toHex));
  };

  // Backgrounds — every differing hex token (white cards included).
  for (const key of Object.keys(l) as (keyof ColorPalette)[]) {
    const lv = l[key];
    const dv = d[key];
    if (typeof lv !== "string" || typeof dv !== "string") continue;
    if (lv.startsWith("#") && dv.startsWith("#")) {
      addHexPair("background-color", lv, dv, seenBg);
    }
  }

  // Foreground — skip pure white so inverse/on-accent text stays readable.
  const fgKeys: (keyof ColorPalette)[] = [
    "textPrimary",
    "textSecondary",
    "textTertiary",
    "textLink",
    "text",
    "navy",
    "spend",
    "chipOn",
    "pillText",
    "tabActive",
    "tabInactive",
    "accentBlue",
    "primary",
    "accent",
    "incomeGreen",
    "incomeGreenText",
    "income",
    "overBudgetRed",
    "overBudgetCallout",
    "danger",
    "warning",
    "success",
    "progressFill",
    "segmentActiveText",
  ];
  for (const key of fgKeys) {
    const lv = l[key];
    const dv = d[key];
    if (lv.startsWith("#") && dv.startsWith("#") && lv.toLowerCase() !== "#ffffff") {
      addHexPair("color", lv, dv, seenFg);
    }
  }

  // Borders / hairlines / dividers
  const borderKeys: (keyof ColorPalette)[] = [
    "borderSubtle",
    "borderHairline",
    "divider",
    "border",
  ];
  for (const key of borderKeys) {
    addHexPair("border-color", l[key], d[key], seenBorder);
  }

  // Extra border-* longhands RN-web may emit
  for (const side of ["border-top-color", "border-bottom-color", "border-left-color", "border-right-color"] as const) {
    for (const key of borderKeys) {
      const from = parseHex(l[key]);
      if (!from) continue;
      const to = d[key];
      chunks.push(
        `html[data-cc-theme="dark"] #root [style*="${side}: ${rgbCss(from)}"],\nhtml[data-cc-theme="dark"] #root [style*="${side}:${rgbCssCompact(from)}"] {\n  ${side}: ${to} !important;\n}`,
      );
    }
  }

  // Soft hairline used by tab bar
  chunks.push(`html[data-cc-theme="dark"] #root [style*="border-top-color: rgba(27, 43, 75, 0.06)"],
html[data-cc-theme="dark"] #root [style*="border-top-color:rgba(27, 43, 75, 0.06)"] {
  border-top-color: ${d.borderSubtle} !important;
}`);

  // Hardcoded light leftovers (Import / Tags / Rules)
  for (const [fromHex, toHex] of [
    ["#F5F7FA", d.bgPage],
    ["#fafafa", d.bgMuted],
    ["#C5CDD8", d.borderSubtle],
    ["#2F6BFF", d.accentBlue],
  ] as const) {
    const from = parseHex(fromHex);
    if (!from) continue;
    chunks.push(rule("background-color", rgbCss(from), toHex));
    chunks.push(rule("background-color", rgbCssCompact(from), toHex));
    chunks.push(rule("border-color", rgbCss(from), toHex));
    chunks.push(rule("border-color", rgbCssCompact(from), toHex));
    chunks.push(rule("color", rgbCss(from), toHex));
    chunks.push(rule("color", rgbCssCompact(from), toHex));
  }

  // Modal scrim rgba
  chunks.push(`html[data-cc-theme="dark"] #root [style*="background-color: rgba(15, 23, 42, 0.4)"],
html[data-cc-theme="dark"] #root [style*="background-color: rgba(15, 23, 42, 0.40)"],
html[data-cc-theme="dark"] #root [style*="background-color:rgba(15, 23, 42, 0.4)"],
html[data-cc-theme="dark"] #root [style*="background-color:rgba(15, 23, 42, 0.40)"] {
  background-color: ${d.bgModalScrim} !important;
}`);

  return chunks.join("\n");
}
