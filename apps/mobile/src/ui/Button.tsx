import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, type } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

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

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  label: { ...type.callout, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});

const variants = {
  primary: {
    bg: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed },
    text: { color: "#fff" },
  },
  secondary: {
    bg: { backgroundColor: colors.success },
    pressed: { opacity: 0.9 },
    text: { color: "#fff" },
  },
  ghost: {
    bg: { backgroundColor: colors.chipBg },
    pressed: { opacity: 0.85 },
    text: { color: colors.text },
  },
  danger: {
    bg: { backgroundColor: colors.danger },
    pressed: { opacity: 0.9 },
    text: { color: "#fff" },
  },
} as const;
