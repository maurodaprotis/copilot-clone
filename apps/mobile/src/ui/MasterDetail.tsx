import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, layout } from "../theme";
import { useIsDesktopWeb } from "./useIsDesktopWeb";

type Props = {
  list: ReactNode;
  detail: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When false on desktop, still stack (e.g. no selection UX yet). Default true. */
  split?: boolean;
};

/** Web desktop: list ~58% / detail ~42%. Mobile: list only (detail rendered by caller via modal). */
export function MasterDetail({ list, detail, style, split = true }: Props) {
  const desktop = useIsDesktopWeb();
  if (!desktop || !split) {
    return <View style={[{ flex: 1 }, style]}>{list}</View>;
  }
  return (
    <View style={[styles.row, style]}>
      <View style={styles.list}>{list}</View>
      <View style={styles.detail} pointerEvents="auto">{detail}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
    backgroundColor: colors.bgPage,
  },
  list: {
    flexBasis: `${layout.listPaneRatio * 100}%`,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderSubtle,
    backgroundColor: colors.bgPage,
  },
  detail: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.bgElevated,
    zIndex: 2,
    elevation: 2,
  },
});
