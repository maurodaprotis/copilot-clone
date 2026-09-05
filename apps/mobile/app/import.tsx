import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  Amount,
  Card,
  Chip,
  GhostButton,
  PrimaryButton,
  Screen,
  ScreenHeader,
  useIsDesktopWeb,
} from "../src/ui";

const SAMPLE = `date,description,amount
2026-09-01,Starbucks,-4.50
2026-09-02,Salary,2500.00
2026-09-03,Uber,-18.20`;

type Step = 1 | 2 | 3 | 4;

export default function ImportScreen() {
  const router = useRouter();
  const desktop = useIsDesktopWeb();
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

  const step: Step = useMemo(() => {
    if (job?.status === "committed") return 4;
    if (preview.length > 0) return 4;
    if (mapping) return 2;
    return 1;
  }, [job, mapping, preview.length]);

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

  const accountName =
    accounts.find((a) => a.id === accountId)?.name ?? "Cash ARS";

  return (
    <>
      <Stack.Screen options={{ title: "Import", headerShown: !desktop }} />
      <Screen>
        <ScreenHeader
          title="Import CSV"
          subtitle="Map columns, pick an account, preview rows — then import into USD reporting (ARS ok)."
        />

        <View style={styles.steps}>
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={[
                styles.step,
                s < step && styles.stepDone,
                s === step && styles.stepOn,
              ]}
            />
          ))}
        </View>

        <Card title="1 · File">
          <View style={styles.drop}>
            <View style={styles.dropIcon}>
              <Text style={{ fontSize: 22 }}>↑</Text>
            </View>
            <Text style={styles.dropStrong}>Paste or edit CSV</Text>
            <Text style={styles.dropHint}>.csv text · sample preloaded</Text>
            <TextInput
              style={styles.csv}
              value={csv}
              onChangeText={setCsv}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={colors.textTertiary}
            />
            {job ? (
              <View style={styles.fileChip}>
                <Text style={styles.fileChipText}>
                  📄 paste.csv · {job.row_count || "…"} rows
                </Text>
              </View>
            ) : null}
          </View>
          <PrimaryButton
            label="Upload & parse"
            onPress={() => void onUpload()}
            loading={busy}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Card title="2 · Column mapping">
          {!mapping ? (
            <Text style={styles.hint}>Upload a file to suggest mapping.</Text>
          ) : (
            <>
              <Text style={styles.hint}>Headers: {headers.join(", ")}</Text>
              {(
                [
                  ["date", "Date"],
                  ["amount", "Amount"],
                  ["description", "Description"],
                  ["currency", "Currency"],
                ] as const
              ).map(([key, label]) => (
                <View key={key} style={styles.mapRow}>
                  <Text style={styles.mapLabel}>{label}</Text>
                  <TextInput
                    style={styles.select}
                    value={(mapping[key] as string | undefined) ?? ""}
                    onChangeText={(v) => setMapField(key, v)}
                    autoCapitalize="none"
                    placeholder="column"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              ))}
              <PrimaryButton
                label="Apply mapping"
                onPress={() => void onMap()}
                loading={busy}
                style={{ marginTop: spacing.sm }}
              />
            </>
          )}
        </Card>

        <Card title="3 · Target account">
          <View style={styles.accountRow}>
            <View style={styles.accountGlyph}>
              <Text>💳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{accountName}</Text>
              <Text style={styles.accountSub}>Manual account</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </View>
          <View style={styles.rowWrap}>
            {(accounts.length
              ? accounts
              : [{ id: DEMO_ACCOUNT_ID, name: "Cash ARS" }]
            ).map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                tone="filled"
                selected={accountId === a.id}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </View>
        </Card>

        <Card title="4 · Preview">
          {preview.length === 0 ? (
            <Text style={styles.hint}>Apply mapping to preview the first rows.</Text>
          ) : (
            <View>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 0.9 }]}>Date</Text>
                <Text style={[styles.th, { flex: 1.4 }]}>Description</Text>
                <Text style={[styles.th, { flex: 0.9, textAlign: "right" }]}>
                  Amount
                </Text>
              </View>
              {preview.slice(0, 5).map((r, i) => {
                const amt = r.amount ?? 0;
                const income = amt > 0;
                return (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.td, { flex: 0.9 }]}>
                      {r.row_date || "—"}
                    </Text>
                    <Text style={[styles.td, { flex: 1.4 }]} numberOfLines={1}>
                      {r.name || "—"}
                    </Text>
                    <View style={{ flex: 0.9, alignItems: "flex-end" }}>
                      <Amount
                        value={`${income ? "+" : ""}${amt}`}
                        variant={income ? "income" : "expense"}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <View style={styles.footer}>
          <GhostButton
            label="Cancel"
            onPress={() => router.back()}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label={
              job?.status === "committed"
                ? "Open To Review"
                : preview.length
                  ? "Import"
                  : mapping
                    ? "Apply mapping"
                    : "Parse CSV"
            }
            onPress={() => {
              if (job?.status === "committed") {
                router.push("/");
                return;
              }
              if (preview.length) {
                void onCommit();
                return;
              }
              if (mapping) {
                void onMap();
                return;
              }
              void onUpload();
            }}
            loading={busy}
            style={{ flex: 1 }}
          />
        </View>

        {job?.status === "committed" ? (
          <GhostButton
            label="Undo import"
            onPress={() => void onUndo()}
            loading={busy}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", gap: 6, marginBottom: spacing.lg },
  step: { flex: 1, height: 4, borderRadius: 999, backgroundColor: colors.borderSubtle },
  stepOn: { backgroundColor: colors.accentBlue },
  stepDone: { backgroundColor: "#93C5FD" },
  drop: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C5CDD8",
    borderRadius: radius.lg,
    backgroundColor: colors.bgInput,
    padding: spacing.xl,
    alignItems: "center",
  },
  dropIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accentBlueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  dropStrong: { ...type.headline, marginBottom: 4 },
  dropHint: { ...type.footnote, color: colors.textTertiary, marginBottom: spacing.md },
  csv: {
    alignSelf: "stretch",
    minHeight: 100,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.textPrimary,
  },
  fileChip: {
    marginTop: spacing.md,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  fileChipText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  hint: { ...type.footnote, color: colors.textSecondary },
  mapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderHairline,
    gap: spacing.md,
  },
  mapLabel: { ...type.callout, fontWeight: "500" },
  select: {
    minWidth: 140,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "right",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: 12,
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  accountGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { ...type.headline },
  accountSub: { ...type.footnote, color: colors.textTertiary },
  chev: { color: colors.textTertiary, fontSize: 18 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tableHead: { flexDirection: "row", marginBottom: 4 },
  th: {
    ...type.sectionLabel,
    fontSize: 10,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderHairline,
  },
  td: { ...type.footnote, fontWeight: "500", color: colors.textPrimary },
  footer: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  msg: { ...type.footnote, marginTop: spacing.sm, color: colors.textPrimary },
});
