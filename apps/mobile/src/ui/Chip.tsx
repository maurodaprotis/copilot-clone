import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, type } from "../theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** filled = navy selected (settings currency); soft = blue soft (filters) */
  tone?: "filled" | "soft";
};

export function Chip({ label, selected, onPress, tone = "soft" }: Props) {
  const onStyle =
    tone === "filled"
      ? selected && styles.onFilled
      : selected && styles.onSoft;
  const onText =
    tone === "filled"
      ? selected && styles.textOnFilled
      : selected && styles.textOnSoft;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, onStyle]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={[styles.text, onText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  onSoft: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: "transparent",
  },
  onFilled: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  text: { ...type.callout, fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  textOnSoft: { color: colors.accentBlue },
  textOnFilled: { color: colors.textInverse },
});
