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

/** RN-web serializes StyleSheet colors as rgba(r,g,b,1.00) in style="" attributes. */
function rgbaForms({ r, g, b }: { r: number; g: number; b: number }): string[] {
  return [
    `rgba(${r}, ${g}, ${b}, 1)`,
    `rgba(${r},${g},${b},1)`,
    `rgba(${r}, ${g}, ${b}, 1.0)`,
    `rgba(${r},${g},${b},1.0)`,
    `rgba(${r}, ${g}, ${b}, 1.00)`,
    `rgba(${r},${g},${b},1.00)`,
    `rgba(${r}, ${g}, ${b}, 1.000)`,
    `rgba(${r},${g},${b},1.000)`,
  ];
}

type PropKind = "background-color" | "color" | "border-color";

function rule(prop: PropKind, from: string, to: string): string {
  return `html[data-cc-theme="dark"] #root [style*="${prop}: ${from}"],\nhtml[data-cc-theme="dark"] #root [style*="${prop}:${from}"] {\n  ${prop}: ${to} !important;\n}`;
}

function rulesForColor(prop: PropKind, fromRgb: { r: number; g: number; b: number }, toHex: string): string[] {
  const out: string[] = [
    rule(prop, rgbCss(fromRgb), toHex),
    rule(prop, rgbCssCompact(fromRgb), toHex),
  ];
  for (const rgba of rgbaForms(fromRgb)) {
    out.push(rule(prop, rgba, toHex));
  }
  return out;
}

/**
 * Web: remap RN-web inline light tokens baked by StyleSheet.create.
 * background remaps include white→card; color remaps skip pure white (inverse text).
 */
export function darkThemeCss(): string {
  const d = darkPalette;
  const l = lightPalette;
  const chunks: string[] = [
    `html[data-cc-theme="dark"],
html[data-cc-theme="dark"] body,
html[data-cc-theme="dark"] #root {
  background-color: ${d.bgPage} !important;
  color: ${d.textPrimary} !important;
  color-scheme: dark;
}
html[data-cc-theme="dark"] #root,
html[data-cc-theme="dark"] #root > div {
  background-color: ${d.bgPage} !important;
  min-height: 100%;
}
html[data-cc-theme="dark"] input::placeholder,
html[data-cc-theme="dark"] textarea::placeholder {
  color: ${d.textTertiary} !important;
  opacity: 1;
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
    chunks.push(...rulesForColor(kind, from, toHex));
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

  // React Navigation DefaultTheme scene background (not our token)
  {
    const navBg = parseHex("#F2F2F2");
    if (navBg) chunks.push(...rulesForColor("background-color", navBg, d.bgPage));
  }

  // Hardcoded light leftovers (Import / Tags / Rules)
  for (const [fromHex, toHex] of [
    ["#F5F7FA", d.bgPage],
    ["#fafafa", d.bgMuted],
    ["#C5CDD8", d.borderSubtle],
    ["#2F6BFF", d.accentBlue],
  ] as const) {
    const from = parseHex(fromHex);
    if (!from) continue;
    chunks.push(...rulesForColor("background-color", from, toHex));
    chunks.push(...rulesForColor("border-color", from, toHex));
    chunks.push(...rulesForColor("color", from, toHex));
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


/** Props we rewrite inside RN-web atomic #react-native-stylesheet rules. */
const ATOMIC_COLOR_PROPS = [
  "color",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "fill",
  "stroke",
] as const;

function hexForms(hex: string): string[] {
  const parsed = parseHex(hex);
  if (!parsed) return [hex, hex.toLowerCase(), hex.toUpperCase()];
  const { r, g, b } = parsed;
  const lower = `#${hex.replace("#", "").toLowerCase()}`;
  const upper = `#${hex.replace("#", "").toUpperCase()}`;
  return [
    lower,
    upper,
    `rgb(${r}, ${g}, ${b})`,
    `rgb(${r},${g},${b})`,
    `rgba(${r}, ${g}, ${b}, 1)`,
    `rgba(${r},${g},${b},1)`,
    `rgba(${r}, ${g}, ${b}, 1.00)`,
    `rgba(${r},${g},${b},1.00)`,
    `rgba(${r}, ${g}, ${b}, 1.000)`,
    `rgba(${r},${g},${b},1.000)`,
  ];
}

type ColorPair = { from: string; to: string };

function pairsForProp(
  prop: (typeof ATOMIC_COLOR_PROPS)[number],
  lightHex: string,
  darkHex: string,
): ColorPair[] {
  if (lightHex === darkHex) return [];
  if (!lightHex.startsWith("#") || !darkHex.startsWith("#")) return [];
  // Never invert pure white text (inverse / on-accent).
  if (prop === "color" && lightHex.toLowerCase() === "#ffffff") return [];
  const out: ColorPair[] = [];
  for (const from of hexForms(lightHex)) {
    out.push({ from, to: darkHex });
  }
  return out;
}

/**
 * Build light→dark replacements for RN-web atomic CSS (insertRule sheets).
 * Background map skips text-only aliases that share navy hex so we still
 * remap page/card whites; navy-as-text is handled via color: pairs.
 */
export function buildAtomicColorPairs(
  direction: "toDark" | "toLight",
): Record<(typeof ATOMIC_COLOR_PROPS)[number], ColorPair[]> {
  const l = lightPalette;
  const d = darkPalette;
  const src = direction === "toDark" ? l : d;
  const dst = direction === "toDark" ? d : l;

  const bgKeys: (keyof ColorPalette)[] = [
    "bgPage",
    "bgCard",
    "bgElevated",
    "bgMuted",
    "bgInput",
    "bgSelection",
    "bgSidebarActive",
    "accentBlueSoft",
    "incomeGreenBg",
    "overBudgetRedSoft",
    "pillBg",
    "categoryPillBg",
    "progressTrack",
    "segmentTrackBg",
    "segmentActiveBg",
    "chipBg",
    "primarySoft",
    "card",
    "bg",
  ];
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
  const borderKeys: (keyof ColorPalette)[] = [
    "borderSubtle",
    "borderHairline",
    "divider",
    "border",
  ];

  const empty = () =>
    Object.fromEntries(ATOMIC_COLOR_PROPS.map((p) => [p, [] as ColorPair[]])) as Record<
      (typeof ATOMIC_COLOR_PROPS)[number],
      ColorPair[]
    >;
  const map = empty();
  const seen = empty();

  const add = (prop: (typeof ATOMIC_COLOR_PROPS)[number], fromHex: string, toHex: string) => {
    for (const pair of pairsForProp(prop, fromHex, toHex)) {
      const key = pair.from.toLowerCase();
      if (seen[prop].some((s) => s.from.toLowerCase() === key)) continue;
      seen[prop].push(pair);
      map[prop].push(pair);
    }
  };

  for (const key of bgKeys) add("background-color", src[key], dst[key]);
  // Hardcoded leftovers
  if (direction === "toDark") {
    add("background-color", "#F5F7FA", d.bgPage);
    add("background-color", "#fafafa", d.bgMuted);
    add("background-color", "#FFFFFF", d.bgCard);
    add("background-color", "#ffffff", d.bgCard);
  } else {
    add("background-color", d.bgPage, l.bgPage);
    add("background-color", d.bgMuted, "#fafafa");
    add("background-color", d.bgCard, l.bgCard);
  }

  for (const key of fgKeys) add("color", src[key], dst[key]);

  for (const key of borderKeys) {
    for (const prop of [
      "border-color",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "outline-color",
    ] as const) {
      add(prop, src[key], dst[key]);
    }
  }

  // Soft hairline used by tab bar / dividers
  if (direction === "toDark") {
    map["border-top-color"].push(
      { from: "rgba(27, 43, 75, 0.06)", to: d.borderSubtle },
      { from: "rgba(27,43,75,0.06)", to: d.borderSubtle },
    );
  }

  return map;
}

function replaceColorValue(value: string, pairs: ColorPair[]): string | null {
  const trimmed = value.trim();
  for (const { from, to } of pairs) {
    if (trimmed === from || trimmed.toLowerCase() === from.toLowerCase()) return to;
  }
  return null;
}

function remapCssText(cssText: string, pairsByProp: Record<string, ColorPair[]>): string {
  let out = cssText;
  for (const prop of ATOMIC_COLOR_PROPS) {
    const pairs = pairsByProp[prop];
    if (!pairs?.length) continue;
    // Match prop:value inside rule bodies
    const re = new RegExp(
      `(${prop}\\s*:\\s*)([^;}{]+)`,
      "gi",
    );
    out = out.replace(re, (full, prefix: string, raw: string) => {
      const mapped = replaceColorValue(raw.trim(), pairs);
      return mapped ? `${prefix}${mapped}` : full;
    });
  }
  return out;
}

let atomicInsertHooked = false;
let atomicDirection: "Light" | "Dark" | null = null;
let nativeInsertRule: typeof CSSStyleSheet.prototype.insertRule | null = null;

function patchExistingAtomicRules(direction: "Light" | "Dark"): void {
  if (typeof document === "undefined") return;
  const pairs = buildAtomicColorPairs(direction === "Dark" ? "toDark" : "toLight");
  const sheets = Array.from(document.querySelectorAll("style")).map((el) => el.sheet);
  // Also walk document.styleSheets for #react-native-stylesheet
  for (let i = 0; i < document.styleSheets.length; i++) {
    sheets.push(document.styleSheets.item(i));
  }
  const seen = new Set<CSSStyleSheet>();
  for (const sheet of sheets) {
    if (!sheet || seen.has(sheet)) continue;
    seen.add(sheet);
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (let r = 0; r < rules.length; r++) {
      const rule = rules.item(r);
      if (!rule || !(rule instanceof CSSStyleRule)) continue;
      for (const prop of ATOMIC_COLOR_PROPS) {
        const current = rule.style.getPropertyValue(prop);
        if (!current) continue;
        const mapped = replaceColorValue(current, pairs[prop]);
        if (mapped) {
          const priority = rule.style.getPropertyPriority(prop);
          rule.style.setProperty(prop, mapped, priority);
        }
      }
    }
  }
}

function hookAtomicInsertRule(direction: "Light" | "Dark"): void {
  if (typeof CSSStyleSheet === "undefined") return;
  if (!nativeInsertRule) {
    nativeInsertRule = CSSStyleSheet.prototype.insertRule;
  }
  const pairs = buildAtomicColorPairs(direction === "Dark" ? "toDark" : "toLight");
  CSSStyleSheet.prototype.insertRule = function hooked(this: CSSStyleSheet, rule: string, index?: number) {
    const next = direction === "Dark" ? remapCssText(rule, pairs) : rule;
    return nativeInsertRule!.call(this, next, index as number);
  };
  atomicInsertHooked = true;
}

function unhookAtomicInsertRule(): void {
  if (!atomicInsertHooked || !nativeInsertRule) return;
  CSSStyleSheet.prototype.insertRule = nativeInsertRule;
  atomicInsertHooked = false;
}

/**
 * RN-web bakes StyleSheet colors into #react-native-stylesheet via insertRule.
 * Attribute selectors cannot see those class rules — rewrite the sheet instead.
 */
export function syncRnWebAtomicStylesheets(resolved: "Light" | "Dark"): void {
  if (typeof document === "undefined") return;
  if (resolved === "Dark") {
    hookAtomicInsertRule("Dark");
    patchExistingAtomicRules("Dark");
  } else {
    unhookAtomicInsertRule();
    // Restore by reverse-mapping currently-dark values back to light.
    if (atomicDirection === "Dark") {
      patchExistingAtomicRules("Light");
    }
  }
  atomicDirection = resolved;
}
