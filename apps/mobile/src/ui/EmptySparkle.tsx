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
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  halo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    position: "relative",
  },
  sparkle: {
    fontSize: 36,
    color: colors.accentBlue,
    fontWeight: "700",
  },
  dot: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: colors.sparkleBlue,
  },
  d1: { top: 18, left: 28, width: 5, height: 5 },
  d2: { top: 32, right: 22, width: 4, height: 4, opacity: 0.7 },
  d3: { bottom: 24, left: 22, width: 3, height: 3 },
  d4: { bottom: 36, right: 30, width: 6, height: 6, opacity: 0.5 },
  title: { ...type.title2, textAlign: "center", marginBottom: spacing.sm },
  body: {
    ...type.callout,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  secondary: { marginTop: spacing.sm },
});
