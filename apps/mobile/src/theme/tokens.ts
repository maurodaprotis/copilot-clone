import { Platform, type TextStyle, type ViewStyle } from "react-native";

/** Copilot Money–inspired light theme tokens (skin only). */
export const colors = {
  bg: "#F5F7FA",
  bgElevated: "#FFFFFF",
  card: "#FFFFFF",
  text: "#1A2B48",
  textSecondary: "#8E9BAE",
  textTertiary: "#A8B3C4",
  border: "#E2E8F0",
  borderSubtle: "#EEF2F6",
  divider: "#EEF1F5",
  primary: "#2F6BFF",
  primarySoft: "#E8F0FF",
  primaryPressed: "#2456D6",
  accent: "#2F6BFF",
  success: "#22C55E",
  successSoft: "#E8F9EF",
  warning: "#F59E0B",
  danger: "#FF4D4D",
  dangerSoft: "#FFECEC",
  income: "#16A34A",
  spend: "#1A2B48",
  chipBg: "#F1F4F8",
  chipOn: "#1A2B48",
  tabInactive: "#9AA6B8",
  tabActive: "#2F6BFF",
  overlay: "rgba(26, 43, 72, 0.45)",
  shadow: "rgba(26, 43, 72, 0.08)",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** SF-like system stack on web; platform default elsewhere. */
export const fontFamily = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: undefined,
});

export const type = {
  largeTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.37,
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
  title1: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.36,
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
  title2: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.35,
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
  title3: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
  headline: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
  body: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: -0.24,
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
  callout: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
  subhead: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.textSecondary,
    fontFamily,
  } satisfies TextStyle,
  footnote: {
    fontSize: 12,
    fontWeight: "400",
    color: colors.textSecondary,
    fontFamily,
  } satisfies TextStyle,
  caption: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textTertiary,
    fontFamily,
  } satisfies TextStyle,
  moneyHero: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
  money: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: colors.text,
    fontFamily,
  } satisfies TextStyle,
} as const;

export const shadow = {
  card: Platform.select<ViewStyle>({
    web: {
      boxShadow: "0 4px 16px rgba(26, 43, 72, 0.06), 0 1px 2px rgba(26, 43, 72, 0.04)",
    } as ViewStyle,
    ios: {
      shadowColor: "#1A2B48",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 2 },
    default: {},
  }),
  tabBar: Platform.select<ViewStyle>({
    web: {
      boxShadow: "0 -1px 12px rgba(26, 43, 72, 0.06)",
    } as ViewStyle,
    ios: {
      shadowColor: "#1A2B48",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

export const layout = {
  screenPadding: spacing.lg,
  cardPadding: spacing.md,
  sectionGap: spacing.lg,
  maxContentWidth: 720,
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  type,
  shadow,
  layout,
  fontFamily,
} as const;

export type Theme = typeof theme;
