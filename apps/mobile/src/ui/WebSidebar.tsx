import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { colors, fontFamily, layout, radius, spacing, type } from "../theme";

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

  return (
    <View style={styles.rail}>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Text style={styles.logoGlyph}>✈</Text>
        </View>
        <Text style={styles.brandTitle}>copilot</Text>
      </View>

      <View style={styles.nav}>
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={[styles.item, active && styles.itemActive]}
            >
              <Text style={[styles.itemGlyph, active && styles.itemGlyphActive]}>
                {item.glyph}
              </Text>
              <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>
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
    backgroundColor: colors.bgElevated,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderSubtle,
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
    backgroundColor: colors.accentBlueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: {
    color: colors.accentBlue,
    fontSize: 13,
    fontWeight: "700",
    transform: [{ rotate: "-28deg" }],
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
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
  itemActive: {
    backgroundColor: colors.bgSidebarActive,
  },
  itemGlyph: {
    width: 22,
    textAlign: "center",
    fontSize: 16,
    color: colors.textTertiary,
  },
  itemGlyphActive: { color: colors.accentBlue, fontWeight: "700" },
  itemLabel: {
    ...type.callout,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  itemLabelActive: { color: colors.accentBlue },
});
