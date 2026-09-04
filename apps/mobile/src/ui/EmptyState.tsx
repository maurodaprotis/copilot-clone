import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "../theme";
import { PrimaryButton } from "./Button";

type Props = {
  icon?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondary?: ReactNode;
};

export function EmptyState({
  icon = "✨",
  title,
  body,
  ctaLabel,
  onCta,
  secondary,
}: Props) {
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
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  icon: { fontSize: 28 },
  title: {
    ...type.headline,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  body: {
    ...type.subhead,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  secondary: { marginTop: spacing.sm },
});
