import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import type { FxRate, FxSeries, UserSettings } from "@copilot-clone/domain";
import { getSettingsLocal, listFxLocal, pullFxFromApi, pullSettingsFromApi, pushFxToApi, pushSettingsToApi } from "../src/offline/settingsImport";

const SERIES: FxSeries[] = ["official", "parallel", "custom"];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [rates, setRates] = useState<FxRate[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [base, setBase] = useState("USD");
  const [quote, setQuote] = useState("ARS");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState("1400");
  const [book, setBook] = useState<FxSeries>("parallel");

  const reload = useCallback(async () => {
    await pullSettingsFromApi().catch(() => null);
    await pullFxFromApi().catch(() => []);
    setSettings(await getSettingsLocal());
    setRates(await listFxLocal());
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function saveSettings(patch: Partial<UserSettings>) {
    setBusy(true); setMsg(null);
    try { setSettings(await pushSettingsToApi(patch)); setMsg("Settings saved"); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function onAddFx() {
    setBusy(true); setMsg(null);
    try {
      await pushFxToApi({ base, quote, as_of: asOf, rate: Number(rate), rate_book: book });
      setMsg("FX rate saved"); await reload();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void reload()} />}>
        <Text style={styles.sub}>Reporting currency · default FX series · manual rates · locale stubs</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Reporting currency</Text>
          <View style={styles.row}>{["USD", "ARS", "EUR"].map((c) => (
            <Pressable key={c} style={[styles.chip, settings?.reporting_currency === c && styles.chipOn]} onPress={() => void saveSettings({ reporting_currency: c })}>
              <Text style={[styles.chipText, settings?.reporting_currency === c && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          ))}</View>
          <Text style={styles.label}>Default FX series</Text>
          <View style={styles.row}>{SERIES.map((s) => (
            <Pressable key={s} style={[styles.chip, settings?.default_fx_series === s && styles.chipOn]} onPress={() => void saveSettings({ default_fx_series: s })}>
              <Text style={[styles.chipText, settings?.default_fx_series === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}</View>
          <Text style={styles.label}>Timezone (stub)</Text>
          <TextInput style={styles.input} value={settings?.timezone ?? ""} onChangeText={(timezone) => setSettings((p) => (p ? { ...p, timezone } : p))}
            onBlur={() => settings && void saveSettings({ timezone: settings.timezone })} placeholder="America/Argentina/Salta" />
          <Text style={styles.label}>Locale (stub)</Text>
          <TextInput style={styles.input} value={settings?.locale ?? ""} onChangeText={(locale) => setSettings((p) => (p ? { ...p, locale } : p))}
            onBlur={() => settings && void saveSettings({ locale: settings.locale })} placeholder="en-US" />
        </View>
        <Text style={styles.section}>Manual FX rates</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.flex]} value={base} onChangeText={setBase} placeholder="base" autoCapitalize="characters" />
            <TextInput style={[styles.input, styles.flex]} value={quote} onChangeText={setQuote} placeholder="quote" autoCapitalize="characters" />
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.flex]} value={asOf} onChangeText={setAsOf} placeholder="as_of" />
            <TextInput style={[styles.input, styles.flex]} value={rate} onChangeText={setRate} placeholder="rate" keyboardType="decimal-pad" />
          </View>
          <View style={styles.row}>{SERIES.map((s) => (
            <Pressable key={s} style={[styles.chip, book === s && styles.chipOn]} onPress={() => setBook(s)}>
              <Text style={[styles.chipText, book === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}</View>
          <Pressable style={styles.btn} onPress={() => void onAddFx()} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save FX rate</Text>}
          </Pressable>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </View>
        {rates.slice(0, 12).map((r) => (
          <View key={`${r.from}:${r.to}:${r.on_date}:${r.rate_book}`} style={styles.card}>
            <Text style={styles.cardTitle}>{r.from}/{r.to} = {r.rate}</Text>
            <Text style={styles.cardMeta}>as_of {r.on_date} · {r.rate_book} · {r.source ?? "manual"}</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f7f7f8" },
  container: { padding: 20, paddingBottom: 48 },
  sub: { color: "#666", marginBottom: 16, fontSize: 12 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "#e2e2e6" },
  label: { fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: "#fafafa" },
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderColor: "#ddd", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fafafa" },
  chipOn: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  chipText: { fontSize: 12, color: "#334" },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  btn: { backgroundColor: "#1a1a2e", paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  msg: { marginTop: 10, color: "#334", fontSize: 13 },
  section: { fontSize: 18, fontWeight: "600", marginBottom: 10, marginTop: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardMeta: { color: "#666", marginTop: 4, fontSize: 12 },
});
