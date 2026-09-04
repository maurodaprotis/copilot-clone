import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "../theme";

type Props = {
  emoji?: string;
  name: string;
};

export function CategoryPill({ emoji, name }: Props) {
  return (
    <View style={styles.pill}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={styles.text} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.categoryPillBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    maxWidth: 140,
  },
  emoji: { fontSize: 11 },
  text: {
    ...type.captionEmphasized,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: colors.textSecondary,
  },
});
