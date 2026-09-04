import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import type { CsvColumnMapping, ImportJob } from "@copilot-clone/domain";
import { DEMO_ACCOUNT_CURRENCY, DEMO_ACCOUNT_ID } from "../src/config";
import { listLocalAccounts } from "../src/offline/accounts";
import { commitImportJobApi, createImportJobApi, mapImportJobApi, undoImportJobApi } from "../src/offline/settingsImport";

const SAMPLE = `date,description,amount
2026-09-01,Starbucks,-4.50
2026-09-02,Salary,2500.00
2026-09-03,Uber,-18.20`;

export default function ImportScreen() {
  const [csv, setCsv] = useState(SAMPLE);
  const [accountId, setAccountId] = useState(DEMO_ACCOUNT_ID);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [preview, setPreview] = useState<Array<{ row_date?: string | null; name?: string | null; amount?: number | null; action?: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    void (async () => {
      try {
        const list = await listLocalAccounts();
        setAccounts(list.map((a) => ({ id: a.id, name: a.name })));
        if (list.length && !list.find((a) => a.id === accountId)) setAccountId(list[0]!.id);
      } catch { /* seed account */ }
    })();
  }, [accountId]));

  async function onUpload() {
    setBusy(true); setMsg(null);
    try {
      const result = await createImportJobApi({ csv_text: csv, account_id: accountId, currency: DEMO_ACCOUNT_CURRENCY, file_name: "paste.csv" });
      setJob(result.job); setHeaders(result.headers); setMapping(result.suggested_mapping); setPreview([]);
      setMsg(`Job ${result.job.status} · ${result.headers.length} columns`);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function onMap() {
    if (!job || !mapping) return;
    setBusy(true); setMsg(null);
    try {
      const result = await mapImportJobApi(job.id, { mapping, account_id: accountId, currency: DEMO_ACCOUNT_CURRENCY });
      setJob(result.job); setPreview((result.preview as typeof preview) ?? []);
      setMsg(`Ready review · ${result.job.row_count} rows`);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function onCommit() {
    if (!job) return;
    setBusy(true); setMsg(null);
    try {
      const result = await commitImportJobApi(job.id);
      setJob(result.job);
      setMsg(`Committed · created ${result.created.length} needs_review · dup ${result.duplicates.length}`);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function onUndo() {
    if (!job) return;
    setBusy(true); setMsg(null);
    try { setJob(await undoImportJobApi(job.id)); setMsg("Undo soft-deleted imported txns"); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  function setMapField(key: keyof CsvColumnMapping, value: string) {
    setMapping((prev) => (prev ? { ...prev, [key]: value || undefined } : prev));
  }

  return (
    <>
      <Stack.Screen options={{ title: "Import CSV" }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.sub}>Bank CSV · mapping → ready_review → committed · fingerprint · needs_review</Text>
        <Text style={styles.label}>Account</Text>
        <View style={styles.rowWrap}>
          {(accounts.length ? accounts : [{ id: DEMO_ACCOUNT_ID, name: "Cash ARS" }]).map((a) => (
            <Pressable key={a.id} style={[styles.chip, accountId === a.id && styles.chipOn]} onPress={() => setAccountId(a.id)}>
              <Text style={[styles.chipText, accountId === a.id && styles.chipTextOn]}>{a.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>CSV (paste OK for web)</Text>
        <TextInput style={[styles.input, styles.csv]} value={csv} onChangeText={setCsv} multiline autoCapitalize="none" autoCorrect={false} />
        <Pressable style={styles.btn} onPress={() => void onUpload()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>1. Upload / parse</Text>}
        </Pressable>
        {mapping ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Column mapping</Text>
            <Text style={styles.hint}>Headers: {headers.join(", ")}</Text>
            {([["date","date"],["description","description"],["amount","amount"],["debit","debit"],["credit","credit"],["currency","currency"]] as const).map(([key, label]) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput style={styles.input} value={(mapping[key] as string | undefined) ?? ""} onChangeText={(v) => setMapField(key, v)} autoCapitalize="none" />
              </View>
            ))}
            <Pressable style={styles.btn} onPress={() => void onMap()} disabled={busy}><Text style={styles.btnText}>2. Apply mapping</Text></Pressable>
          </View>
        ) : null}
        {preview.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Preview</Text>
            {preview.slice(0, 8).map((r, i) => (
              <Text key={i} style={styles.cardMeta}>{r.row_date} · {r.name} · {r.amount} · {r.action}</Text>
            ))}
            <Pressable style={[styles.btn, { marginTop: 10 }]} onPress={() => void onCommit()} disabled={busy}>
              <Text style={styles.btnText}>3. Commit → needs_review</Text>
            </Pressable>
            {job?.status === "committed" ? (
              <Pressable style={[styles.btnSecondary, { marginTop: 8 }]} onPress={() => void onUndo()} disabled={busy}>
                <Text style={styles.btnSecondaryText}>Undo (soft-delete)</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {job ? <Text style={styles.msg}>Job {job.id.slice(0, 8)}… · {job.status} · rows {job.row_count} · created {job.created_count} · dups {job.duplicate_count}</Text> : null}
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f7f7f8" },
  container: { padding: 20, paddingBottom: 48 },
  sub: { color: "#666", marginBottom: 16, fontSize: 12 },
  label: { fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: "#fafafa" },
  csv: { minHeight: 140, fontFamily: "monospace", fontSize: 12 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: "#ddd", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fafafa" },
  chipOn: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  chipText: { fontSize: 12, color: "#334" },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  btn: { backgroundColor: "#1a1a2e", paddingVertical: 12, borderRadius: 8, alignItems: "center", marginBottom: 12 },
  btnText: { color: "#fff", fontWeight: "600" },
  btnSecondary: { borderWidth: 1, borderColor: "#1a1a2e", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  btnSecondaryText: { color: "#1a1a2e", fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "#e2e2e6" },
  cardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  cardMeta: { color: "#666", marginTop: 4, fontSize: 12 },
  hint: { color: "#64748b", fontSize: 11, marginBottom: 8 },
  msg: { marginTop: 8, color: "#334", fontSize: 13 },
});
