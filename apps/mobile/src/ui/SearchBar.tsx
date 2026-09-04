import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, type } from "../theme";

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
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.icon}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
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
    backgroundColor: colors.bgInput,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: { fontSize: 16, color: colors.textTertiary },
  input: {
    flex: 1,
    ...type.body,
    padding: 0,
    color: colors.textPrimary,
  },
});
