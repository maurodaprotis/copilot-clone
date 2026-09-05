import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";
import { PrimaryButton } from "./Button";

type Props = {
  title?: string;
  body?: string;
  /** Prefer omitting CTA on Dashboard To Review empty (Copilot has none). */
  ctaLabel?: string;
  onCta?: () => void;
  secondary?: ReactNode;
};

/** To Review empty: sparkles + soft halo — no giant CTA. */
export function EmptySparkle({
  title = "All caught up!",
  body = "You have no transactions to review. We'll let you know when something pops up.",
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
        <Text style={styles.sparkleLg}>✦</Text>
        <Text style={styles.sparkleSm}>✦</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {ctaLabel && onCta ? (
        <PrimaryButton
          label={ctaLabel}
          variant="ghost"
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
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  halo: {
    width: 80,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    position: "relative",
  },
  sparkleLg: {
    fontSize: 30,
    color: colors.sparkleBlue,
    fontWeight: "700",
    marginLeft: -8,
  },
  sparkleSm: {
    position: "absolute",
    right: 14,
    top: 10,
    fontSize: 16,
    color: colors.accentBlue,
    fontWeight: "700",
    opacity: 0.85,
  },
  dot: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: colors.sparkleBlue,
  },
  d1: { top: 8, left: 18, width: 4, height: 4, opacity: 0.7 },
  d2: { top: 28, right: 10, width: 3, height: 3, opacity: 0.55 },
  d3: { bottom: 10, left: 22, width: 3, height: 3, opacity: 0.5 },
  d4: { bottom: 18, right: 28, width: 5, height: 5, opacity: 0.35 },
  title: {
    ...type.title3,
    textAlign: "center",
    marginBottom: spacing.xs,
    fontWeight: "700",
  },
  body: {
    ...type.footnote,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 17,
  },
  secondary: { marginTop: spacing.sm },
});
