import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, Platform } from "react-native";
import { colors as lightColors, type as lightType } from "./tokens";
import {
  buildType,
  darkThemeCss,
  paletteFor,
  resolveThemeMode,
  syncRnWebAtomicStylesheets,
  type ColorPalette,
  type ThemeMode,
} from "./palettes";

const THEME_KEY = "copilot-theme-mode";

type ThemeContextValue = {
  preference: ThemeMode;
  resolved: "Light" | "Dark";
  colors: ColorPalette;
  type: typeof lightType;
  setPreference: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemeMode {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw === "Light" || raw === "Auto" || raw === "Dark") return raw;
    }
  } catch {
    /* ignore */
  }
  return "Auto";
}

function persistPreference(mode: ThemeMode): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_KEY, mode);
    }
  } catch {
    /* ignore */
  }
}

function applyDomTheme(resolved: "Light" | "Dark"): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.ccTheme = resolved === "Dark" ? "dark" : "light";
  const palette = paletteFor(resolved);
  root.style.backgroundColor = palette.bgPage;
  root.style.colorScheme = resolved === "Dark" ? "dark" : "light";
  document.body.style.backgroundColor = palette.bgPage;
  document.body.style.color = palette.textPrimary;
  const appRoot = document.getElementById("root");
  if (appRoot) {
    appRoot.style.backgroundColor = palette.bgPage;
    appRoot.style.minHeight = "100%";
  }
  let styleEl = document.getElementById("copilot-dark-theme");
  if (resolved === "Dark") {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "copilot-dark-theme";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = darkThemeCss();
  } else if (styleEl) {
    styleEl.remove();
  }
  // RN-web StyleSheet.create colors live in #react-native-stylesheet — remap them.
  syncRnWebAtomicStylesheets(resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemeMode>(readStoredPreference);
  const [systemDark, setSystemDark] = useState(
    () => Appearance.getColorScheme() === "dark",
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemDark(colorScheme === "dark");
    });
    return () => sub.remove();
  }, []);

  const setPreference = useCallback((mode: ThemeMode) => {
    setPreferenceState(mode);
    persistPreference(mode);
  }, []);

  const resolved = resolveThemeMode(preference, systemDark);
  const colors = paletteFor(resolved);
  const type = useMemo(() => buildType(colors), [colors]);

  useEffect(() => {
    applyDomTheme(resolved);
    // Keep legacy module `colors` / `type` in sync for runtime reads (not StyleSheet snapshots).
    Object.assign(lightColors, colors);
    const built = buildType(colors) as Record<string, Record<string, unknown>>;
    for (const [key, style] of Object.entries(built)) {
      const target = (lightType as Record<string, Record<string, unknown>>)[key];
      if (target && style) Object.assign(target, style);
    }
    // Late StyleSheet inserts (first paint of screens) land after this effect — re-sync.
    if (Platform.OS === "web") {
      const t1 = requestAnimationFrame(() => syncRnWebAtomicStylesheets(resolved));
      const t2 = window.setTimeout(() => syncRnWebAtomicStylesheets(resolved), 50);
      const t3 = window.setTimeout(() => syncRnWebAtomicStylesheets(resolved), 250);
      return () => {
        cancelAnimationFrame(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
      };
    }
  }, [resolved, colors]);

  const value = useMemo(
    () => ({ preference, resolved, colors, type, setPreference }),
    [preference, resolved, colors, type, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      preference: "Auto",
      resolved: "Light",
      colors: lightColors as ColorPalette,
      type: lightType,
      setPreference: () => undefined,
    };
  }
  return ctx;
}
