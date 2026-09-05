import type {
  CsvColumnMapping, FxRate, FxSeries, ImportJob, UserSettings,
} from "@copilot-clone/domain";
import { defaultUserSettings, normalizeFxSeries } from "@copilot-clone/domain";
import { API_URL, getApiUserId } from "../config";
import type { LocalDb } from "../db/types";

async function dbOr(dbOverride?: LocalDb): Promise<LocalDb> {
  return dbOverride ?? (await (await import("../db/client")).getDb());
}

function base(): string { return API_URL.replace(/\/$/, ""); }
function headers(): HeadersInit {
  return { "content-type": "application/json", "x-user-id": getApiUserId() };
}

export async function getSettingsLocal(dbOverride?: LocalDb): Promise<UserSettings> {
  const db = await dbOr(dbOverride);
  const row = await db.getFirstAsync<{
    id: string; reporting_currency: string; locale: string; timezone: string; default_fx_series: string;
  }>("SELECT * FROM user_settings WHERE id = 'default' LIMIT 1");
  if (!row) return defaultUserSettings();
  return {
    id: row.id, reporting_currency: row.reporting_currency, locale: row.locale,
    timezone: row.timezone, default_fx_series: normalizeFxSeries(row.default_fx_series),
  };
}

export async function saveSettingsLocal(patch: Partial<UserSettings>, dbOverride?: LocalDb): Promise<UserSettings> {
  const db = await dbOr(dbOverride);
  const current = await getSettingsLocal(db);
  const next = {
    ...current, ...patch,
    reporting_currency: (patch.reporting_currency ?? current.reporting_currency).toUpperCase(),
    default_fx_series: normalizeFxSeries(patch.default_fx_series ?? current.default_fx_series),
  };
  await db.runAsync(
    `INSERT INTO user_settings (id, reporting_currency, locale, timezone, default_fx_series)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       reporting_currency = excluded.reporting_currency,
       locale = excluded.locale, timezone = excluded.timezone,
       default_fx_series = excluded.default_fx_series`,
    next.id, next.reporting_currency, next.locale, next.timezone, next.default_fx_series,
  );
  return next;
}

export async function pullSettingsFromApi(): Promise<UserSettings | null> {
  try {
    const res = await fetch(`${base()}/settings`, { headers: headers() });
    if (!res.ok) return null;
    const data = (await res.json()) as { settings: UserSettings };
    await saveSettingsLocal(data.settings);
    return data.settings;
  } catch { return null; }
}

export async function pushSettingsToApi(patch: Partial<UserSettings>): Promise<UserSettings> {
  const local = await saveSettingsLocal(patch);
  try {
    const res = await fetch(`${base()}/settings`, { method: "POST", headers: headers(), body: JSON.stringify(local) });
    if (res.ok) {
      const data = (await res.json()) as { settings: UserSettings };
      await saveSettingsLocal(data.settings);
      return data.settings;
    }
  } catch { /* offline */ }
  return local;
}

export async function listFxLocal(dbOverride?: LocalDb): Promise<FxRate[]> {
  const db = await dbOr(dbOverride);
  const rows = await db.getAllAsync<{
    from_currency: string; to_currency: string; on_date: string; rate: number; rate_book: string; source: string;
  }>("SELECT * FROM fx_rates ORDER BY on_date DESC");
  return rows.map((r) => ({
    from: r.from_currency, to: r.to_currency, on_date: r.on_date, rate: Number(r.rate),
    rate_book: normalizeFxSeries(r.rate_book), source: (r.source || "manual") as FxRate["source"],
  }));
}

export async function upsertFxLocal(input: {
  base: string; quote: string; as_of: string; rate: number; rate_book: FxSeries;
}, dbOverride?: LocalDb): Promise<void> {
  const db = await dbOr(dbOverride);
  await db.runAsync(
    `INSERT OR REPLACE INTO fx_rates (from_currency, to_currency, on_date, rate, rate_book, source)
     VALUES (?, ?, ?, ?, ?, 'manual')`,
    input.base.toUpperCase(), input.quote.toUpperCase(), input.as_of.slice(0, 10), input.rate, input.rate_book,
  );
}

export async function pushFxToApi(input: {
  base: string; quote: string; as_of: string; rate: number; rate_book: FxSeries;
}): Promise<boolean> {
  await upsertFxLocal(input);
  try {
    const res = await fetch(`${base()}/fx`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
    return res.ok;
  } catch { return false; }
}

export async function pullFxFromApi(): Promise<FxRate[]> {
  try {
    const res = await fetch(`${base()}/fx`, { headers: headers() });
    if (!res.ok) return listFxLocal();
    const data = (await res.json()) as { rates: FxRate[] };
    for (const r of data.rates ?? []) {
      await upsertFxLocal({ base: r.from, quote: r.to, as_of: r.on_date, rate: r.rate, rate_book: r.rate_book });
    }
    return listFxLocal();
  } catch { return listFxLocal(); }
}

export async function createImportJobApi(input: {
  csv_text: string; account_id?: string; currency?: string; file_name?: string;
}): Promise<{ job: ImportJob; headers: string[]; suggested_mapping: CsvColumnMapping }> {
  const res = await fetch(`${base()}/imports`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  if (!res.ok) throw new Error(`import create failed: ${res.status}`);
  return (await res.json()) as { job: ImportJob; headers: string[]; suggested_mapping: CsvColumnMapping };
}

export async function mapImportJobApi(jobId: string, body: {
  mapping: CsvColumnMapping; account_id?: string; currency?: string;
}): Promise<{ job: ImportJob; rows: unknown[]; preview: unknown[] }> {
  const res = await fetch(`${base()}/imports/${jobId}/mapping`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.text()) || `mapping failed: ${res.status}`);
  return (await res.json()) as { job: ImportJob; rows: unknown[]; preview: unknown[] };
}

export async function commitImportJobApi(jobId: string): Promise<{ job: ImportJob; created: string[]; duplicates: string[] }> {
  const res = await fetch(`${base()}/imports/${jobId}/commit`, { method: "POST", headers: headers(), body: "{}" });
  if (!res.ok) throw new Error((await res.text()) || `commit failed: ${res.status}`);
  return (await res.json()) as { job: ImportJob; created: string[]; duplicates: string[] };
}

export async function undoImportJobApi(jobId: string): Promise<ImportJob> {
  const res = await fetch(`${base()}/imports/${jobId}/undo`, { method: "POST", headers: headers(), body: "{}" });
  if (!res.ok) throw new Error(`undo failed: ${res.status}`);
  return ((await res.json()) as { job: ImportJob }).job;
}
