import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../theme";

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ value, onChange, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.track, value && styles.on, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 51,
    height: 31,
    borderRadius: 999,
    backgroundColor: colors.toggleOff,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  on: { backgroundColor: colors.toggleOn },
  knob: {
    width: 27,
    height: 27,
    borderRadius: 999,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  knobOn: { alignSelf: "flex-end" },
});
