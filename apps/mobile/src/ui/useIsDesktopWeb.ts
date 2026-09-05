import { useWindowDimensions, Platform } from "react-native";
import { layout } from "../theme";

/** Desktop web chrome (≥ breakpoint). Mobile web keeps bottom tabs + single column. */
export function useIsDesktopWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= layout.desktopBreakpoint;
}
