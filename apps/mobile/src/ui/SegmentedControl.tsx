import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing, useTheme } from "../theme";

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
  const { colors, type } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.segmentTrackBg }, style]}>
      {options.map((opt) => {
        const on = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.item,
              on &&
                (tone === "dark"
                  ? { backgroundColor: colors.segmentActiveBg }
                  : {
                      backgroundColor: colors.bgCard,
                      shadowColor: colors.textPrimary,
                      shadowOpacity: 0.08,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 1 },
                    }),
            ]}
          >
            <Text
              style={[
                type.callout,
                {
                  fontWeight: "600",
                  fontSize: 13,
                  color: colors.textSecondary,
                },
                on &&
                  (tone === "dark"
                    ? { color: colors.segmentActiveText }
                    : { color: colors.textPrimary }),
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
});
