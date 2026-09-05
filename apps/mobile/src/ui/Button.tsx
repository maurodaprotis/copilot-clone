import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, type } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

/** Primary = navy fill (Copilot). Ghost = white outline. Accent = blue CTA. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        v.bg,
        v.border,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && v.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color as string} />
      ) : (
        <Text style={[styles.label, v.text]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GhostButton(props: Omit<Props, "variant">) {
  return <PrimaryButton {...props} variant="ghost" />;
}

type IconBtnProps = {
  glyph: string;
  onPress: () => void;
  accessibilityLabel: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Compact circular header action (Sync / download style). */
export function IconButton({
  glyph,
  onPress,
  accessibilityLabel,
  loading,
  disabled,
  style,
}: IconBtnProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Text style={styles.iconGlyph}>{glyph}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  label: { ...type.callout, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: "600",
    lineHeight: 18,
  },
});

const variants = {
  primary: {
    bg: { backgroundColor: colors.navy },
    border: {},
    pressed: { opacity: 0.9 },
    text: { color: colors.textInverse },
  },
  accent: {
    bg: { backgroundColor: colors.accentBlue },
    border: {},
    pressed: { backgroundColor: colors.primaryPressed },
    text: { color: colors.textInverse },
  },
  secondary: {
    bg: { backgroundColor: colors.incomeGreen },
    border: {},
    pressed: { opacity: 0.9 },
    text: { color: colors.textInverse },
  },
  ghost: {
    bg: { backgroundColor: colors.bgCard },
    border: { borderWidth: 1, borderColor: colors.borderSubtle },
    pressed: { opacity: 0.85 },
    text: { color: colors.textPrimary },
  },
  danger: {
    bg: { backgroundColor: colors.overBudgetRed },
    border: {},
    pressed: { opacity: 0.9 },
    text: { color: colors.textInverse },
  },
} as const;
