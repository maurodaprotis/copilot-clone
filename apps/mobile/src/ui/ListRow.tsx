import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";

type Props = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
};

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  chevron,
}: Props) {
  const content = (
    <View style={styles.row}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.mid}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Text style={styles.chev}>›</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  left: { width: 36, alignItems: "center" },
  mid: { flex: 1, minWidth: 0 },
  title: { ...type.headline },
  sub: { ...type.footnote, marginTop: 2 },
  chev: {
    fontSize: 22,
    color: colors.textTertiary,
    fontWeight: "300",
    marginLeft: 4,
  },
  pressed: { backgroundColor: colors.primarySoft },
});
