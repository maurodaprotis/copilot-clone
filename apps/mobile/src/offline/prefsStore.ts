/**
 * Web-durable prefs (Pages has no durable sqlite). Used for settings + theme.
 * Native still uses sqlite via settingsImport; this is a sync mirror on web.
 */
import type { UserSettings } from "@copilot-clone/domain";
import { defaultUserSettings, normalizeFxSeries } from "@copilot-clone/domain";

const SETTINGS_KEY = "copilot-user-settings";

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage != null;
  } catch {
    return false;
  }
}

export function readSettingsPrefs(): UserSettings | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      ...defaultUserSettings(),
      ...parsed,
      reporting_currency: String(
        parsed.reporting_currency ?? "USD",
      ).toUpperCase(),
      default_fx_series: normalizeFxSeries(parsed.default_fx_series),
    };
  } catch {
    return null;
  }
}

export function writeSettingsPrefs(settings: UserSettings): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function reportingCurrencyFromPrefs(fallback = "USD"): string {
  return (
    readSettingsPrefs()?.reporting_currency ?? fallback
  ).toUpperCase();
}
