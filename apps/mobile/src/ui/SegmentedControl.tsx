import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, type } from "../theme";

type Props = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** dark = time-range (#374151); light = theme chips (white active) */
  tone?: "dark" | "light";
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  tone = "dark",
  style,
}: Props) {
  return (
    <View style={[styles.track, style]}>
      {options.map((opt) => {
        const on = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.item,
              on && (tone === "dark" ? styles.itemOnDark : styles.itemOnLight),
            ]}
          >
            <Text
              style={[
                styles.label,
                on && (tone === "dark" ? styles.labelOnDark : styles.labelOnLight),
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.segmentTrackBg,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  item: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  itemOnDark: { backgroundColor: colors.segmentActiveBg },
  itemOnLight: {
    backgroundColor: colors.bgCard,
    shadowColor: "#1B2B4B",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  label: { ...type.callout, fontWeight: "600", color: colors.textSecondary, fontSize: 13 },
  labelOnDark: { color: colors.segmentActiveText },
  labelOnLight: { color: colors.textPrimary },
});
