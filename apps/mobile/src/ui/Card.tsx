import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, layout, radius, shadow, spacing, type } from "../theme";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  onPress?: () => void;
};

export function Card({
  children,
  style,
  padded = true,
  title,
  actionLabel,
  onAction,
  onPress,
}: Props) {
  const body = (
    <View style={[styles.card, padded && styles.padded, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} hitSlop={8}>
              <Text style={styles.action}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
        {body}
      </Pressable>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    ...shadow.card,
    overflow: "hidden",
  },
  padded: { padding: layout.cardPadding },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  title: { ...type.headline },
  action: { ...type.footnote, color: colors.textSecondary, fontWeight: "600" },
});

export const cardGap = spacing.cardGap;
