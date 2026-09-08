import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { spacing, useTheme } from "../theme";

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

export function SectionLabel({ children, style }: Props) {
  const { colors, type } = useTheme();
  return (
    <Text style={[type.sectionLabel, styles.label, { color: colors.textTertiary }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
    marginLeft: 4,
    marginTop: spacing.xs,
  },
});
