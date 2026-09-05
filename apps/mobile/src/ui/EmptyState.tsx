import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "../theme";
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
      <View style={styles.iconBubble}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
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
    backgroundColor: colors.accentBlueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  icon: { fontSize: 24 },
  title: { ...type.headline, textAlign: "center", marginBottom: 2 },
  body: {
    ...type.footnote,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 16,
  },
  secondary: { marginTop: spacing.sm },
});
