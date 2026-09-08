import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { radius, spacing, useTheme } from "../theme";

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
  const { colors, type } = useTheme();
  const variants = {
    primary: {
      bg: { backgroundColor: colors.navy },
      border: {} as ViewStyle,
      pressed: { opacity: 0.9 },
      text: { color: colors.textInverse },
    },
    accent: {
      bg: { backgroundColor: colors.accentBlue },
      border: {} as ViewStyle,
      pressed: { backgroundColor: colors.primaryPressed },
      text: { color: colors.textInverse },
    },
    secondary: {
      bg: { backgroundColor: colors.incomeGreen },
      border: {} as ViewStyle,
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
      border: {} as ViewStyle,
      pressed: { opacity: 0.9 },
      text: { color: colors.textInverse },
    },
  } as const;
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
        <Text style={[type.callout, styles.label, v.text]}>{label}</Text>
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
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.borderSubtle,
        },
        (disabled || loading) && styles.disabled,
        pressed && !disabled && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Text style={[styles.iconGlyph, { color: colors.textSecondary }]}>{glyph}</Text>
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
  label: { fontWeight: "600" },
  disabled: { opacity: 0.5 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 18,
  },
});
