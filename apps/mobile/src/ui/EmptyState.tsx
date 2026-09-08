import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme } from "../theme";
import { PrimaryButton } from "./Button";
import { EmptySparkle } from "./EmptySparkle";

type Props = {
  icon?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondary?: ReactNode;
  /** Use Copilot To Review sparkle treatment */
  sparkle?: boolean;
};

export function EmptyState({
  icon = "✨",
  title,
  body,
  ctaLabel,
  onCta,
  secondary,
  sparkle,
}: Props) {
  const { colors, type } = useTheme();
  if (sparkle) {
    return (
      <EmptySparkle
        title={title}
        body={body}
        ctaLabel={ctaLabel}
        onCta={onCta}
        secondary={secondary}
      />
    );
  }
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconBubble, { backgroundColor: colors.accentBlueSoft }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={[type.headline, styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {body ? (
        <Text style={[type.footnote, styles.body, { color: colors.textSecondary }]}>{body}</Text>
      ) : null}
      {ctaLabel && onCta ? (
        <PrimaryButton
          label={ctaLabel}
          onPress={onCta}
          variant="accent"
          style={{ marginTop: spacing.md, alignSelf: "center", minWidth: 160 }}
        />
      ) : null}
      {secondary ? <View style={styles.secondary}>{secondary}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  icon: { fontSize: 24 },
  title: { textAlign: "center", marginBottom: 2 },
  body: {
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 16,
  },
  secondary: { marginTop: spacing.sm },
});
