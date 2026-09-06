import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "../../src/theme";
import { Card, ListRow, Screen, ScreenHeader, SectionLabel } from "../../src/ui";

const ITEMS: { title: string; href: string; icon: string; section: string }[] = [
  { section: "Money", title: "Accounts", href: "/accounts", icon: "🏦" },
  { section: "Money", title: "Recurring", href: "/recurrings", icon: "🔁" },
  { section: "Money", title: "Investments", href: "/investments", icon: "📈" },
  { section: "Data", title: "Import CSV", href: "/import", icon: "📄" },
  { section: "Data", title: "Settings", href: "/settings", icon: "⚙️" },
  { section: "Support", title: "About / Support", href: "/settings", icon: "ℹ️" },
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
