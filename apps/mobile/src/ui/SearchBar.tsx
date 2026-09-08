import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing, useTheme } from "../theme";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
  style,
}: Props) {
  const { colors, type } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.bgInput }, style]}>
      <Text style={[styles.icon, { color: colors.textTertiary }]}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, type.body, { color: colors.textPrimary }]}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 40,
    borderRadius: radius.input,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: { fontSize: 16 },
  input: {
    flex: 1,
    padding: 0,
  },
});
