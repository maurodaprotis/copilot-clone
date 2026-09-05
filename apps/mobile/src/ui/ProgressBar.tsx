import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "../theme";

type Props = {
  progress: number; // 0..1+
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({
  progress,
  color = colors.progressFill,
  trackColor = colors.progressTrack,
  height = 6,
  style,
}: Props) {
  const pct = Math.max(0, Math.min(progress, 1));
  const over = progress > 1;
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <View
        style={[
          styles.fill,
          {
            width: `${pct * 100}%`,
            backgroundColor: over ? colors.overBudgetRed : color,
            height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.pill,
    overflow: "hidden",
    width: "100%",
  },
  fill: { borderRadius: radius.pill },
});
