import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radius, spacing, type } from "../../src/theme";
import { Card, ListRow, Screen, ScreenHeader, SectionLabel } from "../../src/ui";

const ITEMS: { title: string; subtitle?: string; href: string; icon: string; section: string }[] = [
  { section: "Money", title: "Accounts", subtitle: "Balances · net worth", href: "/accounts", icon: "🏦" },
  { section: "Money", title: "Recurring", subtitle: "Bills · income · templates", href: "/recurrings", icon: "🔁" },
  { section: "Money", title: "Investments", subtitle: "Coming soon", href: "/accounts", icon: "📈" },
  { section: "Data", title: "Import CSV", subtitle: "Bank CSV → needs review", href: "/import", icon: "📄" },
  { section: "Data", title: "Settings", subtitle: "Currency · FX · locale", href: "/settings", icon: "⚙️" },
  { section: "Support", title: "About / Support", subtitle: "Copilot Money clone", href: "/settings", icon: "ℹ️" },
];

export default function MoreScreen() {
  const router = useRouter();
  const sections = ["Money", "Data", "Support"];
  return (
    <Screen scroll>
      <ScreenHeader title="More" />
      {sections.map((section) => (
        <View key={section} style={styles.section}>
          <SectionLabel>{section}</SectionLabel>
          <Card padded={false}>
            {ITEMS.filter((i) => i.section === section).map((item, i, arr) => (
              <View key={item.title}>
                <ListRow
                  title={item.title}
                  subtitle={item.subtitle}
                  chevron
                  left={
                    <View style={styles.iconCircle}>
                      <Text style={styles.icon}>{item.icon}</Text>
                    </View>
                  }
                  onPress={() => router.push(item.href as never)}
                />
                {i < arr.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 56,
  },
});
