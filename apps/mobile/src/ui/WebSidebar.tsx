import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { fontFamily, layout, radius, spacing, useTheme } from "../theme";

type NavItem = {
  label: string;
  href: string;
  glyph: string;
  match: (path: string) => boolean;
};

const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    glyph: "⌂",
    match: (p) => p === "/" || p === "" || p.endsWith("/(tabs)") || p.endsWith("/(tabs)/"),
  },
  {
    label: "Transactions",
    href: "/transactions",
    glyph: "☰",
    match: (p) => p.includes("transactions"),
  },
  {
    label: "Accounts",
    href: "/accounts",
    glyph: "🏦",
    match: (p) => p.includes("accounts") && !p.includes("investments"),
  },
  {
    label: "Investments",
    href: "/investments",
    glyph: "📈",
    match: (p) => p.includes("investments"),
  },
  {
    label: "Categories",
    href: "/categories",
    glyph: "▦",
    match: (p) => p.includes("categories"),
  },
  {
    label: "Cash Flow",
    href: "/cash-flow",
    glyph: "▥",
    match: (p) => p.includes("cash-flow"),
  },
  {
    label: "More",
    href: "/more",
    glyph: "•••",
    match: (p) =>
      p.includes("more") ||
      p.includes("import") ||
      p.includes("recurrings") ||
      p.includes("rules") ||
      p.includes("tags"),
  },
  {
    label: "Settings",
    href: "/settings",
    glyph: "⚙",
    match: (p) => p.includes("settings"),
  },
];

export function WebSidebar() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.rail,
        {
          backgroundColor: colors.bgElevated,
          borderRightColor: colors.borderSubtle,
        },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.logoMark, { backgroundColor: colors.accentBlueSoft }]}>
          <Text style={[styles.logoGlyph, { color: colors.accentBlue }]}>✈</Text>
        </View>
        <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>copilot</Text>
      </View>

      <View style={styles.nav}>
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={[
                styles.item,
                active && { backgroundColor: colors.bgSidebarActive },
              ]}
            >
              <Text
                style={[
                  styles.itemGlyph,
                  { color: active ? colors.accentBlue : colors.textTertiary },
                  active && { fontWeight: "700" },
                ]}
              >
                {item.glyph}
              </Text>
              <Text
                style={[
                  styles.itemLabel,
                  { color: active ? colors.accentBlue : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: layout.sidebarWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: {
    fontSize: 13,
    fontWeight: "700",
    transform: [{ rotate: "-28deg" }],
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  nav: { gap: 2 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  itemGlyph: {
    width: 22,
    textAlign: "center",
    fontSize: 16,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily,
  },
});
