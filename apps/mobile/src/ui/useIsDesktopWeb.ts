import { useEffect, useState } from "react";
import { useWindowDimensions, Platform } from "react-native";
import { layout } from "../theme";

/**
 * Desktop web chrome (≥ breakpoint).
 * SSR / static export always renders mobile first so hydration matches the
 * empty prerender HTML; after mount we switch to desktop when width allows.
 * Avoids React #418/#422 mismatches that left Pages looking empty until Sync.
 */
export function useIsDesktopWeb(): boolean {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return false;
  return Platform.OS === "web" && width >= layout.desktopBreakpoint;
}
