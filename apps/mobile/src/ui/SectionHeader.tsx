import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";

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
  return (
    <View style={styles.row}>
      <Text style={styles.title}>
        {title}
        {count != null ? (
          <Text style={styles.count}> ({count})</Text>
        ) : null}
      </Text>
      {right}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
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
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  title: { ...type.title3, flex: 1 },
  count: { color: colors.textSecondary, fontWeight: "600" },
  action: { ...type.callout, color: colors.textSecondary, fontWeight: "600" },
});
