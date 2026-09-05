import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";
import { PrimaryButton } from "./Button";

type Props = {
  title?: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondary?: ReactNode;
};

/** To Review empty: four-point sparkle + blue particle halo. */
export function EmptySparkle({
  title = "You’re all caught up",
  body = "No transactions need review. When new spends land, they’ll sparkle here so you can unlock intelligence.",
  ctaLabel,
  onCta,
  secondary,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.halo}>
        <View style={[styles.dot, styles.d1]} />
        <View style={[styles.dot, styles.d2]} />
        <View style={[styles.dot, styles.d3]} />
        <View style={[styles.dot, styles.d4]} />
        <Text style={styles.sparkle}>✦</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {ctaLabel && onCta ? (
        <PrimaryButton
          label={ctaLabel}
          variant="accent"
          onPress={onCta}
          style={{ marginTop: spacing.md, alignSelf: "stretch" }}
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
  halo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    position: "relative",
  },
  sparkle: {
    fontSize: 28,
    color: colors.accentBlue,
    fontWeight: "700",
  },
  dot: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: colors.sparkleBlue,
  },
  d1: { top: 12, left: 18, width: 4, height: 4 },
  d2: { top: 20, right: 14, width: 3, height: 3, opacity: 0.7 },
  d3: { bottom: 14, left: 14, width: 3, height: 3 },
  d4: { bottom: 22, right: 18, width: 5, height: 5, opacity: 0.5 },
  title: { ...type.title3, textAlign: "center", marginBottom: spacing.xs },
  body: {
    ...type.footnote,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 16,
  },
  secondary: { marginTop: spacing.sm },
});
