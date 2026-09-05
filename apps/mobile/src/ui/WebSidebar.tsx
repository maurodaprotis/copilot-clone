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
    label: "Categories",
    href: "/categories",
    glyph: "▦",
    match: (p) => p.includes("categories"),
  },
  {
    label: "Transactions",
    href: "/transactions",
    glyph: "☰",
    match: (p) => p.includes("transactions"),
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
      p.includes("settings") ||
      p.includes("accounts") ||
      p.includes("import") ||
      p.includes("recurrings") ||
      p.includes("rules") ||
      p.includes("tags"),
  },
];

export function WebSidebar() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  return (
    <View style={styles.rail}>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Text style={styles.logoGlyph}>◆</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>copilot</Text>
          <Text style={styles.brandSub}>MONEY</Text>
        </View>
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

      <View style={styles.footer}>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => router.push("/settings" as never)}
        >
          <Text style={styles.settingsGlyph}>⚙</Text>
          <Text style={styles.settingsLabel}>Settings</Text>
        </Pressable>
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
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    justifyContent: "flex-start",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: { color: "#fff", fontSize: 14, fontWeight: "700" },
  brandTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    fontFamily,
    lineHeight: 18,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.textTertiary,
    fontFamily,
  },
  nav: { gap: 2, flex: 1 },
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
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  settingsGlyph: { width: 22, textAlign: "center", fontSize: 15, color: colors.textTertiary },
  settingsLabel: { ...type.callout, color: colors.textSecondary, fontWeight: "600" },
});
