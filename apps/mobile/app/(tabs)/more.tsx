import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radius, spacing, type } from "../../src/theme";
import { Card, ListRow, Screen, ScreenHeader } from "../../src/ui";

const SECTIONS: {
  title: string;
  items: { title: string; subtitle: string; href: string; icon: string }[];
}[] = [
  {
    title: "Money",
    items: [
      {
        title: "Accounts",
        subtitle: "Balances · net worth",
        href: "/accounts",
        icon: "🏦",
      },
      {
        title: "Recurrings",
        subtitle: "Bills · income · templates",
        href: "/recurrings",
        icon: "🔁",
      },
    ],
  },
  {
    title: "Organize",
    items: [
      {
        title: "Name Rules",
        subtitle: "Auto-categorize by merchant",
        href: "/rules",
        icon: "✨",
      },
      {
        title: "Tags",
        subtitle: "Labels without budget impact",
        href: "/tags",
        icon: "🏷",
      },
    ],
  },
  {
    title: "Data",
    items: [
      {
        title: "Import",
        subtitle: "Bank CSV → needs review",
        href: "/import",
        icon: "📄",
      },
      {
        title: "Settings",
        subtitle: "Currency · FX · locale",
        href: "/settings",
        icon: "⚙️",
      },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  return (
    <Screen scroll>
      <ScreenHeader title="More" subtitle="Accounts, bills, import, and settings" />
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Card padded={false}>
            {section.items.map((item, i) => (
              <View key={item.href}>
                <ListRow
                  title={item.title}
                  subtitle={item.subtitle}
                  chevron
                  left={<Text style={styles.icon}>{item.icon}</Text>}
                  onPress={() => router.push(item.href as never)}
                />
                {i < section.items.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
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
  sectionTitle: {
    ...type.caption,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  icon: {
    fontSize: 18,
    width: 32,
    height: 32,
    textAlign: "center",
    lineHeight: 32,
    backgroundColor: colors.chipBg,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 56,
  },
});
