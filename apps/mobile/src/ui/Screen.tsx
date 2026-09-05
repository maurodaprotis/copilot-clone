import { type ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, layout, spacing } from "../theme";
import { useIsDesktopWeb } from "./useIsDesktopWeb";

type Props = {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  /** Fill available height without max-width clamp (master–detail panes). */
  flush?: boolean;
};

export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  scroll = true,
  flush = false,
}: Props) {
  const desktop = useIsDesktopWeb();
  const pad = [
    styles.pad,
    desktop && !flush && styles.padWeb,
    flush && styles.padFlush,
    contentStyle,
  ];

  if (!scroll) {
    return <View style={[styles.root, ...pad, styles.fill]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[...pad, styles.content, desktop && !flush && styles.contentWeb]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentBlue}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPage },
  pad: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  padWeb: {
    paddingHorizontal: layout.webContentPadding,
    paddingTop: spacing.lg,
    maxWidth: layout.maxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  padFlush: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    maxWidth: undefined,
  },
  fill: { flex: 1, minHeight: 0 },
  content: { flexGrow: 1 },
  contentWeb: { maxWidth: layout.maxContentWidth, width: "100%", alignSelf: "center" },
});
