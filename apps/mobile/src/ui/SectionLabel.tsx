import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { spacing, type } from "../theme";

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

export function SectionLabel({ children, style }: Props) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...type.sectionLabel,
    marginBottom: spacing.sm,
    marginLeft: 4,
    marginTop: spacing.xs,
  },
});
