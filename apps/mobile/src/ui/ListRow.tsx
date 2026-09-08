import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "../theme";

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
  const { colors, type } = useTheme();
  const content = (
    <View style={styles.row}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.mid}>
        <Text style={[type.headline, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[type.footnote, { marginTop: 2, color: colors.textTertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? (
        <Text style={[styles.chev, { color: colors.textTertiary }]}>›</Text>
      ) : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          pressed && { backgroundColor: colors.accentBlueSoft },
        ]}
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
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  left: { width: 36, alignItems: "center" },
  mid: { flex: 1, minWidth: 0 },
  chev: {
    fontSize: 22,
    fontWeight: "300",
    marginLeft: 4,
  },
});
