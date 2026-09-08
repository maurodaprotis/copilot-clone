import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "../theme";

type Props = {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
};

export function SectionHeader({
  title,
  count,
  actionLabel,
  onAction,
  right,
}: Props) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[type.title3, styles.title, { color: colors.textPrimary }]}>
        {title}
        {count != null ? (
          <Text style={[styles.count, { color: colors.textSecondary }]}> ({count})</Text>
        ) : null}
      </Text>
      {right}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[type.callout, styles.action, { color: colors.textSecondary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: { flex: 1 },
  count: { fontWeight: "600" },
  action: { fontWeight: "600" },
});
