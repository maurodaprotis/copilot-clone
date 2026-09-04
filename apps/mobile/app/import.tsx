import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import type { CsvColumnMapping, ImportJob } from "@copilot-clone/domain";
import { DEMO_ACCOUNT_CURRENCY, DEMO_ACCOUNT_ID } from "../src/config";
import { listLocalAccounts } from "../src/offline/accounts";
import {
  commitImportJobApi,
  createImportJobApi,
  mapImportJobApi,
  undoImportJobApi,
} from "../src/offline/settingsImport";
import { colors, radius, spacing, type } from "../src/theme";
import {
  Card,
  Chip,
  EmptyState,
  PrimaryButton,
  Screen,
  SectionHeader,
} from "../src/ui";

const SAMPLE = `date,description,amount
2026-09-01,Starbucks,-4.50
2026-09-02,Salary,2500.00
2026-09-03,Uber,-18.20`;

export default function ImportScreen() {
  const router = useRouter();
  const [csv, setCsv] = useState(SAMPLE);
  const [accountId, setAccountId] = useState(DEMO_ACCOUNT_ID);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [preview, setPreview] = useState<
    Array<{
      row_date?: string | null;
      name?: string | null;
      amount?: number | null;
      action?: string;
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const list = await listLocalAccounts();
          setAccounts(list.map((a) => ({ id: a.id, name: a.name })));
          if (list.length && !list.find((a) => a.id === accountId)) {
            setAccountId(list[0]!.id);
          }
        } catch {
          /* seed account */
        }
      })();
    }, [accountId]),
  );

  async function onUpload() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await createImportJobApi({
        csv_text: csv,
        account_id: accountId,
        currency: DEMO_ACCOUNT_CURRENCY,
        file_name: "paste.csv",
      });
      setJob(result.job);
      setHeaders(result.headers);
      setMapping(result.suggested_mapping);
      setPreview([]);
      setMsg(`Parsed · ${result.headers.length} columns`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onMap() {
    if (!job || !mapping) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await mapImportJobApi(job.id, {
        mapping,
        account_id: accountId,
        currency: DEMO_ACCOUNT_CURRENCY,
      });
      setJob(result.job);
      setPreview((result.preview as typeof preview) ?? []);
      setMsg(`Ready · ${result.job.row_count} rows`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!job) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await commitImportJobApi(job.id);
      setJob(result.job);
      setMsg(
        `Committed · ${result.created.length} to review · ${result.duplicates.length} dups`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onUndo() {
    if (!job) return;
    setBusy(true);
    setMsg(null);
    try {
      setJob(await undoImportJobApi(job.id));
      setMsg("Undo soft-deleted imported transactions");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function setMapField(key: keyof CsvColumnMapping, value: string) {
    setMapping((prev) =>
      prev ? { ...prev, [key]: value || undefined } : prev,
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Import" }} />
      <Screen>
        <Text style={styles.lead}>
          Paste a bank CSV, map columns, preview, then commit into your To
          Review inbox.
        </Text>

        <Text style={styles.groupLabel}>Account</Text>
        <View style={styles.rowWrap}>
          {(accounts.length
            ? accounts
            : [{ id: DEMO_ACCOUNT_ID, name: "Cash ARS" }]
          ).map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={accountId === a.id}
              onPress={() => setAccountId(a.id)}
            />
          ))}
        </View>

        <Text style={styles.groupLabel}>CSV</Text>
        <Card>
          <TextInput
            style={[styles.input, styles.csv]}
            value={csv}
            onChangeText={setCsv}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textTertiary}
          />
          <PrimaryButton
            label="1 · Upload & parse"
            onPress={() => void onUpload()}
            loading={busy}
          />
        </Card>

        {!mapping ? (
          <Card style={{ marginTop: spacing.md }}>
            <EmptyState
              icon="📄"
              title="Start with a CSV"
              body="Paste rows above (web) or use the sample, then upload to suggest column mapping."
            />
          </Card>
        ) : null}

        {mapping ? (
          <>
            <SectionHeader title="Column mapping" />
            <Card>
              <Text style={styles.hint}>Headers: {headers.join(", ")}</Text>
              {(
                [
                  ["date", "Date"],
                  ["description", "Description"],
                  ["amount", "Amount"],
                  ["debit", "Debit"],
                  ["credit", "Credit"],
                  ["currency", "Currency"],
                ] as const
              ).map(([key, label]) => (
                <View key={key}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={(mapping[key] as string | undefined) ?? ""}
                    onChangeText={(v) => setMapField(key, v)}
                    autoCapitalize="none"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              ))}
              <PrimaryButton
                label="2 · Apply mapping"
                onPress={() => void onMap()}
                loading={busy}
              />
            </Card>
          </>
        ) : null}

        {preview.length > 0 ? (
          <>
            <SectionHeader title="Preview" />
            <Card>
              {preview.slice(0, 8).map((r, i) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewName}>
                    {r.name || "—"}
                  </Text>
                  <Text style={styles.previewMeta}>
                    {r.row_date} · {r.amount} · {r.action}
                  </Text>
                </View>
              ))}
              <PrimaryButton
                label="3 · Commit to To Review"
                onPress={() => void onCommit()}
                loading={busy}
                style={{ marginTop: spacing.sm }}
              />
              {job?.status === "committed" ? (
                <>
                  <PrimaryButton
                    label="Undo import"
                    variant="ghost"
                    onPress={() => void onUndo()}
                    loading={busy}
                    style={{ marginTop: spacing.sm }}
                  />
                  <PrimaryButton
                    label="Open To Review"
                    variant="secondary"
                    onPress={() => router.push("/")}
                    style={{ marginTop: spacing.sm }}
                  />
                </>
              ) : null}
            </Card>
          </>
        ) : null}

        {job ? (
          <Text style={styles.msg}>
            Job {job.id.slice(0, 8)}… · {job.status} · rows {job.row_count} ·
            created {job.created_count} · dups {job.duplicate_count}
          </Text>
        ) : null}
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  lead: { ...type.subhead, marginBottom: spacing.lg, lineHeight: 18 },
  groupLabel: { ...type.caption, marginBottom: spacing.sm, marginLeft: 4 },
  label: {
    ...type.footnote,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 4,
    color: colors.text,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.chipBg,
    color: colors.text,
    fontSize: 15,
  },
  csv: { minHeight: 140, fontFamily: "monospace", fontSize: 12 },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  hint: { ...type.footnote, marginBottom: spacing.sm },
  previewRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  previewName: { ...type.headline },
  previewMeta: { ...type.footnote, marginTop: 2 },
  msg: { ...type.footnote, marginTop: spacing.sm, color: colors.text },
});
