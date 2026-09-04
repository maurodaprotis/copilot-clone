import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { colors, type } from "../theme";

type Variant = "expense" | "income" | "over" | "neutral";

type Props = {
  value: string;
  variant?: Variant;
  size?: "list" | "hero" | "display";
  style?: StyleProp<TextStyle>;
};

export function Amount({ value, variant = "expense", size = "list", style }: Props) {
  const sizeStyle =
    size === "display"
      ? type.displayAmount
      : size === "hero"
        ? type.heroAmount
        : type.amountList;
  const color =
    variant === "income"
      ? colors.incomeGreen
      : variant === "over"
        ? colors.overBudgetCallout
        : colors.textPrimary;
  return <Text style={[sizeStyle, { color }, style]}>{value}</Text>;
}
