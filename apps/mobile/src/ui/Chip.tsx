import { Pressable, StyleSheet, Text } from "react-native";
import { radius, useTheme } from "../theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** filled = navy selected (settings currency); soft = blue soft (filters) */
  tone?: "filled" | "soft";
};

export function Chip({ label, selected, onPress, tone = "soft" }: Props) {
  const { colors, type } = useTheme();
  const bg = selected
    ? tone === "filled"
      ? colors.navy
      : colors.accentBlueSoft
    : colors.bgMuted;
  const fg = selected
    ? tone === "filled"
      ? colors.textInverse
      : colors.accentBlue
    : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: bg }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={[type.callout, styles.text, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 0,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
  },
});
