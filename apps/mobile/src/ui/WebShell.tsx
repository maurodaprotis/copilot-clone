import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme";
import { useIsDesktopWeb } from "./useIsDesktopWeb";
import { WebSidebar } from "./WebSidebar";

/** Persistent left rail + main column for desktop web (tabs + stack screens). */
export function WebShell({ children }: { children: ReactNode }) {
  const desktop = useIsDesktopWeb();
  const { colors } = useTheme();
  return (
    <View style={[styles.shell, { backgroundColor: colors.bgPage }]}>
      {desktop ? <WebSidebar /> : null}
      <View style={styles.main}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row" },
  main: { flex: 1, minWidth: 0 },
});
