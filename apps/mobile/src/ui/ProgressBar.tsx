import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, useTheme } from "../theme";

type Props = {
  progress: number; // 0..1+
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 6,
  style,
}: Props) {
  const { colors } = useTheme();
  const fill = color ?? colors.progressFill;
  const track = trackColor ?? colors.progressTrack;
  const pct = Math.max(0, Math.min(progress, 1));
  const over = progress > 1;
  return (
    <View style={[styles.track, { height, backgroundColor: track }, style]}>
      <View
        style={[
          styles.fill,
          {
            width: `${pct * 100}%`,
            backgroundColor: over ? colors.overBudgetRed : fill,
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
