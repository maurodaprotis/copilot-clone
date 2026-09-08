import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { radius, shadow, spacing, useTheme } from "../theme";
import { SectionLabel } from "./SectionLabel";

type Props = {
  label?: string;
  children: ReactNode;
};

/** iOS-style inset grouped settings card. */
export function SettingsGroup({ label, children }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgCard },
          shadow.card,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function SettingsDivider() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: colors.borderHairline },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
  },
});
