import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import {
  ACCOUNT_TYPES,
  isLiabilityAccount,
  type Account,
  type AccountBalanceRow,
  type AccountType,
} from "@copilot-clone/domain";
import { NetWorthTrendChart } from "../src/components/NetWorthTrendChart";
import {
  getAccountsOverview,
  upsertAccountLocal,
} from "../src/offline/accounts";
import { pullAccountsFromApi } from "../src/sync/pullAccounts";
import { syncOutbox } from "../src/offline/syncOutbox";
import { createApiTransport } from "../src/sync/apiTransport";
import { colors, radius, spacing, type } from "../src/theme";
import {
  Card,
  EmptyState,
  IconButton,
  MasterDetail,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SegmentedControl,
  useIsDesktopWeb,
} from "../src/ui";

const RANGES = ["1W", "1M", "3M", "YTD", "1Y", "ALL"] as const;

const SECTION_ORDER: AccountType[] = [
  "credit_card",
  "depository",
  "investment",
  "loan",
  "other",
  "real_estate",
];

function sectionLabel(t: AccountType): string {
  switch (t) {
    case "credit_card":
      return "Credit cards";
    case "depository":
      return "Depository";
    case "investment":
      return "Investments";
    case "loan":
      return "Loans";
    case "real_estate":
      return "Other";
    case "other":
    default:
      return "Other";
  }
}

function typeChipLabel(t: AccountType): string {
  switch (t) {
    case "credit_card":
      return "Credit card";
    case "depository":
      return "Depository";
    case "investment":
      return "Investment";
    case "loan":
      return "Loan";
    case "real_estate":
      return "Real estate";
    default:
      return "Other";
  }
}

function usd(n: number, digits = 0): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function usdBal(n: number): string {
  return usd(n, 2);
}

const emptyForm = {
  id: undefined as string | undefined,
  name: "",
  currency: "USD",
  type: "depository" as Account["type"],
  current_balance: "0",
  include_in_net_worth: true,
};

export default function AccountsScreen() {
  const desktop = useIsDesktopWeb();
  const [rows, setRows] = useState<AccountBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>("1W");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await pullAccountsFromApi().catch(() => false);
      const overview = await getAccountsOverview();
      setRows(overview.rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const { assets, debts } = useMemo(() => {
    let a = 0;
    let d = 0;
    for (const row of rows) {
      if (!row.account.include_in_net_worth || row.account.is_archived) continue;
      if (isLiabilityAccount(row.account)) d += Math.abs(row.balance_reporting);
      else a += row.balance_reporting;
    }
    return { assets: a, debts: d };
  }, [rows]);

  const bySection = useMemo(() => {
    const map = new Map<string, AccountBalanceRow[]>();
    for (const row of rows) {
      if (row.account.is_archived) continue;
      const key = sectionLabel(row.account.type);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    const ordered: [string, AccountBalanceRow[]][] = [];
    const seen = new Set<string>();
    for (const t of SECTION_ORDER) {
      const label = sectionLabel(t);
      if (seen.has(label)) continue;
      seen.add(label);
      const list = map.get(label);
      if (list?.length) ordered.push([label, list]);
    }
    for (const [label, list] of map) {
      if (!seen.has(label) && list.length) ordered.push([label, list]);
    }
    return ordered;
  }, [rows]);

  const selected = useMemo(
    () => rows.find((r) => r.account.id === selectedId) ?? null,
    [rows, selectedId],
  );

  function openCreate() {
    setForm(emptyForm);
    setMsg(null);
    setFormOpen(true);
  }

  function openEdit(row: AccountBalanceRow) {
    setSelectedId(row.account.id);
    setForm({
      id: row.account.id,
      name: row.account.name,
      currency: row.account.currency,
      type: row.account.type,
      current_balance: String(row.balance_account ?? row.account.current_balance ?? 0),
      include_in_net_worth: row.account.include_in_net_worth,
    });
  }

  async function onSave() {
    if (!form.name.trim()) {
      setMsg("Name is required");
      return;
    }
    const bal = Number(form.current_balance);
    if (!Number.isFinite(bal)) {
      setMsg("Balance must be a number");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const result = await upsertAccountLocal({
        id: form.id,
        name: form.name.trim(),
        currency: form.currency.trim() || "USD",
        type: form.type,
        current_balance: bal,
        include_in_net_worth: form.include_in_net_worth,
      });
      await syncOutbox(createApiTransport()).catch(() => ({ pushed: 0 }));
      setFormOpen(false);
      setSelectedId(result.id);
      await reload();
      setMsg(form.id ? "Account updated" : "Account created");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function archiveAccount(
    row: AccountBalanceRow,
    reason: "hide" | "closed" | "delete",
  ) {
    setSaving(true);
    setMsg(null);
    setMoreOpen(false);
    try {
      await upsertAccountLocal({
        id: row.account.id,
        name: row.account.name,
        currency: row.account.currency,
        type: row.account.type,
        current_balance: row.balance_account ?? row.account.current_balance ?? 0,
        include_in_net_worth: reason === "hide" ? false : row.account.include_in_net_worth,
        is_archived: reason !== "hide",
      });
      await syncOutbox(createApiTransport()).catch(() => ({ pushed: 0 }));
      setSelectedId(null);
      await reload();
      setMsg(
        reason === "hide"
          ? "Account hidden from net worth"
          : reason === "closed"
            ? "Account marked as closed"
            : "Account deleted",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const assetsPct = assets > 0 ? 999 : 0;
  const debtsPct = debts > 0 ? 999 : 0;

  const summaryCard = (
    <Card style={styles.summaryCard}>
      <View style={styles.nwRow}>
        <View style={styles.nwCol}>
          <View style={styles.dotRow}>
            <View style={[styles.dot, { backgroundColor: colors.assetBlueDot }]} />
            <Text style={styles.nwLabel}>Assets</Text>
          </View>
          <Text style={[styles.nwValue, { color: colors.assetBlue }]}>
            {usd(assets)}
          </Text>
          {assetsPct > 0 ? (
            <View style={[styles.pctPill, styles.pctUp]}>
              <Text style={[styles.pctText, { color: colors.incomeGreenText }]}>
                ↗ {assetsPct}%
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.nwCol}>
          <View style={styles.dotRow}>
            <View style={[styles.dot, { backgroundColor: colors.debtOrangeDot }]} />
            <Text style={styles.nwLabel}>Debts</Text>
          </View>
          <Text style={[styles.nwValue, { color: colors.debtOrange }]}>
            {usd(debts)}
          </Text>
          {debtsPct > 0 ? (
            <View style={[styles.pctPill, styles.pctDown]}>
              <Text style={[styles.pctText, { color: colors.overBudgetRed }]}>
                ↗ {debtsPct}%
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <NetWorthTrendChart
        assets={assets}
        debts={debts}
        rangeKey={range}
        width={desktop ? 420 : 320}
        height={72}
      />
      <SegmentedControl
        options={[...RANGES]}
        value={range}
        onChange={setRange}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );

  const listBody = (
    <>
      <ScreenHeader
        title="Accounts"
        right={
          <IconButton
            glyph="＋"
            accessibilityLabel="Add an account"
            onPress={openCreate}
          />
        }
      />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      {summaryCard}

      {bySection.map(([label, typeRows]) => {
        const isCollapsed = collapsed[label] === true;
        return (
          <View key={label} style={styles.group}>
            <Pressable
              onPress={() =>
                setCollapsed((c) => ({ ...c, [label]: !isCollapsed }))
              }
              style={styles.groupHeader}
            >
              <Text style={styles.groupTitle}>
                {isCollapsed ? "▸" : "▾"} {label}
              </Text>
            </Pressable>
            {!isCollapsed
              ? typeRows.map((row) => {
                  const on = selectedId === row.account.id;
                  return (
                    <Pressable
                      key={row.account.id}
                      style={[styles.row, on && styles.rowOn]}
                      onPress={() => openEdit(row)}
                    >
                      <View style={styles.iconBubble}>
                        <Text style={styles.iconGlyph}>🏛</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {row.account.name}
                        </Text>
                        <Text style={styles.rowMeta}>Manual account</Text>
                      </View>
                      <Text style={styles.rowBal}>
                        {usdBal(row.balance_reporting)}
                      </Text>
                    </Pressable>
                  );
                })
              : null}
          </View>
        );
      })}

      {rows.filter((r) => !r.account.is_archived).length === 0 && !loading ? (
        <Card>
          <EmptyState
            icon="🏦"
            title="No accounts yet"
            body="Add a manual account to track assets and debts."
            ctaLabel="Add an account"
            onCta={openCreate}
          />
        </Card>
      ) : null}
    </>
  );

  const detailBody = selected ? (
    <View style={styles.detailPad}>
      <View style={styles.detailTop}>
        <Text style={styles.detailTitle}>{selected.account.name}</Text>
        <Pressable
          onPress={() => setMoreOpen(true)}
          hitSlop={10}
          style={styles.moreBtn}
          accessibilityLabel="More options"
        >
          <Text style={styles.moreGlyph}>···</Text>
        </Pressable>
      </View>
      <Text style={styles.detailMeta}>
        {sectionLabel(selected.account.type)} · Manual account
      </Text>
      <Text style={styles.detailBal}>
        {usdBal(selected.balance_reporting)}
      </Text>
      <Text style={styles.detailHint}>
        {selected.account.include_in_net_worth
          ? "Included in net worth"
          : "Hidden from net worth"}
      </Text>
      <PrimaryButton
        label="Edit account"
        variant="secondary"
        onPress={() => {
          openEdit(selected);
          setFormOpen(true);
        }}
        style={{ marginTop: spacing.lg, alignSelf: "flex-start" }}
      />
    </View>
  ) : (
    <View style={styles.detailEmpty}>
      <Text style={styles.detailEmptyIcon}>🗂</Text>
      <Text style={styles.detailEmptyText}>Select to view details</Text>
    </View>
  );

  const formModal = (
    <Modal visible={formOpen} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <ScrollView contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {form.id ? "Edit account" : "Add an account"}
          </Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(name) => setForm((f) => ({ ...f, name }))}
            placeholder="e.g. Demo Visa 4242"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.typeChip, form.type === t && styles.typeChipOn]}
                onPress={() => setForm((f) => ({ ...f, type: t }))}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    form.type === t && styles.typeChipTextOn,
                  ]}
                >
                  {typeChipLabel(t)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Currency</Text>
          <TextInput
            style={styles.input}
            value={form.currency}
            autoCapitalize="characters"
            onChangeText={(currency) => setForm((f) => ({ ...f, currency }))}
            placeholder="USD"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.fieldLabel}>Balance</Text>
          <TextInput
            style={styles.input}
            value={form.current_balance}
            keyboardType="decimal-pad"
            onChangeText={(current_balance) =>
              setForm((f) => ({ ...f, current_balance }))
            }
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Include in net worth</Text>
            <Switch
              value={form.include_in_net_worth}
              onValueChange={(include_in_net_worth) =>
                setForm((f) => ({ ...f, include_in_net_worth }))
              }
            />
          </View>
          {msg && formOpen ? <Text style={styles.msg}>{msg}</Text> : null}
          <View style={styles.modalActions}>
            <PrimaryButton
              label="Cancel"
              variant="ghost"
              onPress={() => setFormOpen(false)}
            />
            <PrimaryButton
              label="Save"
              onPress={() => void onSave()}
              loading={saving}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const moreModal = selected ? (
    <Modal visible={moreOpen} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.moreSheet}>
          <Text style={styles.modalTitle}>More options</Text>
          <Pressable
            style={styles.moreRow}
            onPress={() => void archiveAccount(selected, "hide")}
          >
            <Text style={styles.moreRowText}>Hide account</Text>
          </Pressable>
          <Pressable
            style={styles.moreRow}
            onPress={() => void archiveAccount(selected, "closed")}
          >
            <Text style={styles.moreRowText}>Mark as closed</Text>
          </Pressable>
          <Pressable
            style={styles.moreRow}
            onPress={() => void archiveAccount(selected, "delete")}
          >
            <Text style={[styles.moreRowText, { color: colors.danger }]}>
              Delete account
            </Text>
          </Pressable>
          <PrimaryButton
            label="Cancel"
            variant="ghost"
            onPress={() => setMoreOpen(false)}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    </Modal>
  ) : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {desktop ? (
        <MasterDetail
          list={
            <Screen
              flush
              refreshing={loading}
              onRefresh={() => void reload()}
              contentStyle={styles.listPad}
            >
              {listBody}
            </Screen>
          }
          detail={detailBody}
        />
      ) : (
        <Screen refreshing={loading} onRefresh={() => void reload()}>
          {listBody}
          {selected ? (
            <Card style={{ marginTop: spacing.md }}>{detailBody}</Card>
          ) : null}
        </Screen>
      )}
      {formModal}
      {moreModal}
    </>
  );
}

const styles = StyleSheet.create({
  listPad: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  summaryCard: { marginBottom: spacing.lg },
  nwRow: { flexDirection: "row", gap: spacing.xl, marginBottom: spacing.sm },
  nwCol: { flex: 1 },
  dotRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nwLabel: { ...type.footnote, color: colors.textSecondary, fontWeight: "600" },
  nwValue: { ...type.heroAmount, fontSize: 28, lineHeight: 34 },
  pctPill: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pctUp: { backgroundColor: colors.incomeGreenBg },
  pctDown: { backgroundColor: colors.overBudgetRedSoft },
  pctText: { fontSize: 11, fontWeight: "700" },
  group: { marginBottom: spacing.md },
  groupHeader: { paddingVertical: 6 },
  groupTitle: { ...type.title3, color: colors.textPrimary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  rowOn: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: "transparent",
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: { fontSize: 16 },
  rowName: { ...type.headline },
  rowMeta: { ...type.footnote, color: colors.textTertiary, marginTop: 2 },
  rowBal: { ...type.amountList },
  msg: { ...type.footnote, color: colors.textPrimary, marginBottom: spacing.sm },
  detailPad: { padding: spacing.xl },
  detailTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailTitle: { ...type.title1, flex: 1 },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  moreGlyph: { fontSize: 18, color: colors.textSecondary, fontWeight: "700" },
  detailMeta: { ...type.footnote, color: colors.textTertiary, marginTop: 4 },
  detailBal: { ...type.displayAmount, marginTop: spacing.lg },
  detailHint: { ...type.footnote, marginTop: spacing.sm },
  detailEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  detailEmptyIcon: { fontSize: 40, opacity: 0.35, marginBottom: spacing.sm },
  detailEmptyText: { ...type.callout, color: colors.textTertiary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.bgModalScrim,
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.modal,
    padding: spacing.xl,
  },
  moreSheet: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.modal,
    padding: spacing.xl,
  },
  modalTitle: { ...type.title2, marginBottom: spacing.md },
  fieldLabel: { ...type.footnote, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: colors.bgInput,
    color: colors.textPrimary,
    fontSize: 15,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
  },
  typeChipOn: { backgroundColor: colors.accentBlue },
  typeChipText: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  typeChipTextOn: { color: colors.textInverse },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  moreRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHairline,
  },
  moreRowText: { ...type.headline },
});
