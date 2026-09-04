import type { FxSeries, UserSettings } from "./types.js";

export const DEFAULT_USER_SETTINGS_ID = "default";

export function defaultUserSettings(
  overrides: Partial<UserSettings> = {},
): UserSettings {
  return {
    id: DEFAULT_USER_SETTINGS_ID,
    reporting_currency: "USD",
    locale: "en-US",
    timezone: "America/Argentina/Salta",
    default_fx_series: "parallel",
    ...overrides,
  };
}

export function normalizeFxSeries(value: string | null | undefined): FxSeries {
  if (value === "official" || value === "custom" || value === "parallel") {
    return value;
  }
  return "parallel";
}

export function mergeUserSettings(
  current: UserSettings,
  patch: Partial<UserSettings>,
): UserSettings {
  return {
    ...current,
    ...patch,
    reporting_currency: (
      patch.reporting_currency ?? current.reporting_currency
    ).toUpperCase(),
    default_fx_series: normalizeFxSeries(
      patch.default_fx_series ?? current.default_fx_series,
    ),
  };
}
