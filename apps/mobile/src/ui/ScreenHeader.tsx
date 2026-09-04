import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  large?: boolean;
};

export function ScreenHeader({ title, subtitle, right, large = true }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={large ? type.largeTitle : type.title1} numberOfLines={1}>
          {title}
        </Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  right: { flexShrink: 0 },
  sub: { ...type.subhead, marginTop: spacing.xxs, color: colors.textSecondary },
});
