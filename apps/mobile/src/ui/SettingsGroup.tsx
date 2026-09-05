import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, shadow, spacing } from "../theme";
import { SectionLabel } from "./SectionLabel";

type Props = {
  label?: string;
  children: ReactNode;
};

/** iOS-style inset grouped settings card. */
export function SettingsGroup({ label, children }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingsDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.card,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderHairline,
    marginLeft: spacing.lg,
  },
});
