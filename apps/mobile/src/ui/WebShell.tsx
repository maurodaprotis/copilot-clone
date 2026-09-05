import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { useIsDesktopWeb } from "./useIsDesktopWeb";
import { WebSidebar } from "./WebSidebar";

/** Persistent left rail + main column for desktop web (tabs + stack screens). */
export function WebShell({ children }: { children: ReactNode }) {
  const desktop = useIsDesktopWeb();
  return (
    <View style={styles.shell}>
      {desktop ? <WebSidebar /> : null}
      <View style={styles.main}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: colors.bgPage },
  main: { flex: 1, minWidth: 0 },
});
