import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import type {
  Recurring,
  RecurringCadence,
  RecurringKind,
} from "@copilot-clone/domain";
import { DEMO_ACCOUNT_ID } from "../src/config";
import {
  listRecurringsLocal,
  pullRecurringsFromApi,
  upsertRecurringLocal,
} from "../src/offline/recurrings";
import {
  listAllTransactions,
  type LocalTransaction,
} from "../src/offline/queries";
import { syncOutbox } from "../src/offline/syncOutbox";
import { createApiTransport } from "../src/sync/apiTransport";
import { colors, radius, spacing, type } from "../src/theme";
import {
  Card,
  CategoryPill,
  EmptyState,
  IconButton,
  MasterDetail,
  PrimaryButton,
  Screen,
  ScreenHeader,
  useIsDesktopWeb,
} from "../src/ui";

/** Copilot Confirm-frequency radios (live audit). Map extras to nearest API cadence. */
const FREQ_OPTIONS: {
  label: string;
  cadence: RecurringCadence;
  suggested?: boolean;
}[] = [
  { label: "Every week", cadence: "weekly" },
  { label: "Every 2 weeks", cadence: "biweekly" },
  { label: "Every month", cadence: "monthly", suggested: true },
  { label: "Every 2 months", cadence: "monthly" },
  { label: "Every 3 months", cadence: "quarterly" },
  { label: "Every 4 months", cadence: "quarterly" },
  { label: "Every 6 months", cadence: "yearly" },
  { label: "Every year", cadence: "yearly" },
];

function usd(n: number, digits = 0): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function cadenceLabel(c: RecurringCadence): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function formatDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const day = d.getDate();
  const mon = d.toLocaleString("en-US", { month: "short" });
  const suf =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${mon} ${day}${suf}`;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function categoryName(r: Recurring): string {
  if (r.kind === "income") return "INCOME";
  if (r.category_id?.includes("other") || !r.category_id) return "OTHER";
  if (r.category_id.includes("util")) return "UTILITIES";
  return "OTHER";
}

export default function RecurringsScreen() {
  const desktop = useIsDesktopWeb();
  const [items, setItems] = useState<Recurring[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<"pick" | "frequency">("pick");
  const [txnChoices, setTxnChoices] = useState<LocalTransaction[]>([]);
  const [txnSearch, setTxnSearch] = useState("");
  const [pickedTxn, setPickedTxn] = useState<LocalTransaction | null>(null);
  const [freqLabel, setFreqLabel] = useState("Every month");
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("Fake Rent Payment");
  const [kind, setKind] = useState<RecurringKind>("expense");
  const [cadence, setCadence] = useState<RecurringCadence>("monthly");
  const [amount, setAmount] = useState("12000");
  const [currency, setCurrency] = useState("USD");
  const [nextDate, setNextDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [thisMonthOpen, setThisMonthOpen] = useState(true);

  const reload = useCallback(async () => {
    try {
      const pulled = await pullRecurringsFromApi();
      setItems(pulled.recurrings);
    } catch {
      setItems(await listRecurringsLocal().catch(() => []));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const nowYm = new Date().toISOString().slice(0, 7);

  const { leftToPay, paidSoFar, thisMonth, future } = useMemo(() => {
    let left = 0;
    let paid = 0;
    const month: Recurring[] = [];
    const fut: Recurring[] = [];
    for (const r of items) {
      if (!r.active) continue;
      const ym = monthKey(r.next_expected_date);
      // Copilot chrome: still due this month → left to pay; next rolled forward → paid.
      if (ym <= nowYm) {
        left += Number(r.expected_amount) || 0;
        month.push(r);
      } else {
        paid += Number(r.expected_amount) || 0;
        // Shot 22: paid Fake Rent still listed under This month with checkmark.
        month.push(r);
      }
    }
    return {
      leftToPay: left,
      paidSoFar: paid,
      thisMonth: month,
      future: fut,
    };
  }, [items, nowYm]);

  const selected = useMemo(
    () => items.find((r) => r.id === selectedId) ?? null,
    [items, selectedId],
  );

  const progress =
    leftToPay + paidSoFar > 0 ? paidSoFar / (leftToPay + paidSoFar) : 1;

  async function openCreate() {
    setEditId(null);
    setWizardStep("pick");
    setPickedTxn(null);
    setTxnSearch("");
    setFreqLabel("Every month");
    setCadence("monthly");
    setMsg(null);
    setFormOpen(true);
    try {
      const txns = await listAllTransactions();
      setTxnChoices(txns);
    } catch {
      setTxnChoices([]);
    }
  }

  function openEdit(r: Recurring) {
    setSelectedId(r.id);
    setEditId(r.id);
    setName(r.name);
    setKind(r.kind);
    setCadence(r.cadence);
    setAmount(String(r.expected_amount));
    setCurrency(r.currency);
    setNextDate(r.next_expected_date.slice(0, 10));
    setActive(r.active);
    setMsg(null);
  }

  function pickTxn(t: LocalTransaction) {
    setPickedTxn(t);
    const label = (t.note && t.note.trim()) || "Transaction";
    setName(label);
    setKind(t.is_refund ? "income" : "expense");
    setAmount(String(Math.abs(Number(t.amount_reporting) || Number(t.amount) || 0)));
    setCurrency(t.currency || "USD");
    setNextDate((t.posted_at || new Date().toISOString()).slice(0, 10));
    setActive(true);
    setWizardStep("frequency");
  }

  async function onCreateFromWizard() {
    setBusy(true);
    setMsg(null);
    try {
      const id = await upsertRecurringLocal({
        name: name.trim() || "Recurring",
        kind,
        cadence,
        expected_amount: Number(amount) || 0,
        currency: currency.trim() || "USD",
        category_id:
          pickedTxn?.category_id ??
          (kind === "income" ? "cat-salary" : "cat-other"),
        account_id: pickedTxn?.account_id ?? DEMO_ACCOUNT_ID,
        next_expected_date: nextDate.slice(0, 10),
        active: true,
      });
      await syncOutbox(createApiTransport()).catch(() => ({ pushed: 0 }));
      setMsg("Recurring created");
      setFormOpen(false);
      setSelectedId(id);
      setEditId(null);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteRecurring() {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    setMoreOpen(false);
    try {
      await upsertRecurringLocal({
        id: selected.id,
        name: selected.name,
        kind: selected.kind,
        cadence: selected.cadence,
        expected_amount: Number(selected.expected_amount) || 0,
        currency: selected.currency,
        category_id: selected.category_id,
        account_id: selected.account_id,
        next_expected_date: selected.next_expected_date.slice(0, 10),
        active: false,
      });
      await syncOutbox(createApiTransport()).catch(() => ({ pushed: 0 }));
      setSelectedId(null);
      setMsg("Recurring deleted");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const filteredTxns = useMemo(() => {
    const q = txnSearch.trim().toLowerCase();
    const list = txnChoices.filter((t) => {
      const label = (t.note ?? "").toLowerCase();
      if (!q) return true;
      return label.includes(q) || t.id.toLowerCase().includes(q);
    });
    return list.slice(0, 40);
  }, [txnChoices, txnSearch]);

  const ringSize = 72;
  const stroke = 6;
  const r = (ringSize - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = `${(progress * c).toFixed(1)} ${c.toFixed(1)}`;

  const summaryCard = (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryAmount}>{usd(leftToPay)}</Text>
          <Text style={styles.summaryLabel}>left to pay</Text>
        </View>
        <View style={styles.ringWrap}>
          <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              fill="none"
              stroke={colors.progressTrack}
              strokeWidth={stroke}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              fill="none"
              stroke={colors.textPrimary}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeLinecap="round"
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            />
          </svg>
        </View>
        <View style={[styles.summaryCol, { alignItems: "flex-end" }]}>
          <Text style={styles.summaryAmount}>{usd(paidSoFar)}</Text>
          <Text style={styles.summaryLabel}>paid so far</Text>
        </View>
      </View>
    </Card>
  );

  function renderRow(r: Recurring) {
    const on = selectedId === r.id;
    const paid =
      monthKey(r.next_expected_date) > nowYm ||
      (leftToPay === 0 && paidSoFar > 0);
    return (
      <Pressable
        key={r.id}
        style={[styles.row, on && styles.rowOn]}
        onPress={() => openEdit(r)}
      >
        <Text style={styles.rowDate}>{formatDay(r.next_expected_date)}</Text>
        <View style={styles.rowIcon}>
          <Text style={{ fontSize: 16 }}>🧑‍💼</Text>
        </View>
        <View style={styles.rowMid}>
          <Text style={styles.rowName} numberOfLines={1}>
            {r.name}{" "}
            <Text style={styles.rowCadence}>{cadenceLabel(r.cadence)}</Text>
          </Text>
        </View>
        <CategoryPill name={categoryName(r)} emoji="📦" color="#A78BFA" />
        <Text style={styles.rowAmt}>
          {usd(Number(r.expected_amount) || 0, 2)}
        </Text>
        {paid ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>
    );
  }

  const listBody = (
    <>
      <ScreenHeader
        title="Recurrings"
        right={
          <IconButton
            glyph="＋"
            accessibilityLabel="Add a recurring"
            onPress={() => void openCreate()}
          />
        }
      />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      {summaryCard}

      <Pressable
        onPress={() => setThisMonthOpen((v) => !v)}
        style={styles.sectionHead}
      >
        <Text style={styles.sectionTitle}>
          {thisMonthOpen ? "▾" : "▸"} This month
        </Text>
      </Pressable>
      {thisMonthOpen ? (
        thisMonth.length === 0 && items.filter((r) => r.active).length === 0 ? (
          <Card>
            <EmptyState
              icon="🔁"
              title="No recurrings yet"
              body="Add a monthly bill or paycheck template."
              ctaLabel="Add a recurring"
              onCta={() => void openCreate()}
            />
          </Card>
        ) : (
          <Card padded={false} style={styles.listCard}>
            {(thisMonth.length ? thisMonth : items.filter((r) => r.active)).map(
              renderRow,
            )}
          </Card>
        )
      ) : null}

      {future.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
            In the future
          </Text>
          <Card padded={false} style={styles.listCard}>
            {future.map(renderRow)}
          </Card>
        </>
      ) : null}
    </>
  );

  const detailBody = selected ? (
    <View style={styles.detailPad}>
      <View style={styles.detailTop}>
        <Text style={[styles.detailTitle, { flex: 1 }]}>{selected.name}</Text>
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
        {cadenceLabel(selected.cadence)} · {selected.kind}
        {selected.active ? "" : " · inactive"}
      </Text>
      <Text style={styles.detailAmt}>
        {usd(Number(selected.expected_amount) || 0, 2)}
      </Text>
      <Text style={styles.detailHint}>
        Next payment around {formatDay(selected.next_expected_date)}
      </Text>
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
          {wizardStep === "pick" ? (
            <>
              <Text style={styles.modalTitle}>New recurring</Text>
              <Text style={styles.fieldLabel}>Search</Text>
              <TextInput
                style={styles.input}
                value={txnSearch}
                onChangeText={setTxnSearch}
                placeholder="Search transactions"
                placeholderTextColor={colors.textTertiary}
              />
              {filteredTxns.length === 0 ? (
                <Text style={styles.msg}>
                  No transactions to pick. Add a txn first, then create a
                  recurring.
                </Text>
              ) : (
                filteredTxns.map((t) => {
                  const label = (t.note && t.note.trim()) || "Transaction";
                  const amt = Math.abs(
                    Number(t.amount_reporting) || Number(t.amount) || 0,
                  );
                  return (
                    <Pressable
                      key={t.id}
                      style={styles.pickRow}
                      onPress={() => pickTxn(t)}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.pickName} numberOfLines={1}>
                          {label}
                        </Text>
                        <Text style={styles.pickMeta}>
                          {formatDay(t.posted_at || nextDate)}
                        </Text>
                      </View>
                      <Text style={styles.pickAmt}>{usd(amt, 2)}</Text>
                    </Pressable>
                  );
                })
              )}
              <View style={styles.modalActions}>
                <PrimaryButton
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setFormOpen(false)}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>Confirm the frequency</Text>
              <Text style={styles.pickMeta}>
                {name} · {usd(Number(amount) || 0, 2)}
              </Text>
              <View style={{ marginTop: spacing.md, gap: 4 }}>
                {FREQ_OPTIONS.map((opt) => {
                  const on = freqLabel === opt.label;
                  return (
                    <Pressable
                      key={opt.label}
                      style={[styles.freqRow, on && styles.freqRowOn]}
                      onPress={() => {
                        setFreqLabel(opt.label);
                        setCadence(opt.cadence);
                      }}
                    >
                      <View
                        style={[styles.radio, on && styles.radioOn]}
                      />
                      <Text style={styles.freqLabel}>
                        {opt.label}
                        {opt.suggested ? (
                          <Text style={styles.suggested}> · Suggested</Text>
                        ) : null}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.pickMeta, { marginTop: spacing.sm }]}>
                Unsupported cadences map to nearest API cadence (weekly /
                biweekly / monthly / quarterly / yearly).
              </Text>
              {msg && formOpen ? <Text style={styles.msg}>{msg}</Text> : null}
              <View style={styles.modalActions}>
                <PrimaryButton
                  label="Back"
                  variant="ghost"
                  onPress={() => setWizardStep("pick")}
                />
                <PrimaryButton
                  label="Next"
                  onPress={() => void onCreateFromWizard()}
                  loading={busy}
                />
              </View>
            </>
          )}
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
            style={styles.pickRow}
            onPress={() => void onDeleteRecurring()}
          >
            <Text style={[styles.pickName, { color: colors.danger }]}>
              Delete recurring
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
              refreshing={false}
              onRefresh={() => void reload()}
              contentStyle={styles.listPad}
            >
              {listBody}
            </Screen>
          }
          detail={detailBody}
        />
      ) : (
        <Screen refreshing={false} onRefresh={() => void reload()}>
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
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryCol: { flex: 1 },
  summaryAmount: { ...type.title1 },
  summaryLabel: { ...type.footnote, color: colors.textTertiary, marginTop: 2 },
  ringWrap: { width: 72, height: 72 },
  sectionHead: { paddingVertical: 6, marginBottom: 4 },
  sectionTitle: { ...type.title3 },
  listCard: { overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHairline,
  },
  rowOn: { backgroundColor: colors.accentBlueSoft },
  rowDate: {
    ...type.footnote,
    color: colors.textTertiary,
    width: 56,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMid: { flex: 1, minWidth: 0 },
  rowName: { ...type.headline },
  rowCadence: {
    ...type.footnote,
    color: colors.textTertiary,
    fontWeight: "400",
  },
  rowAmt: { ...type.amountList },
  check: {
    color: colors.accentBlue,
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 2,
  },
  msg: { ...type.footnote, marginBottom: spacing.sm, color: colors.textPrimary },
  detailPad: { padding: spacing.xl },
  detailTitle: { ...type.title1 },
  detailMeta: { ...type.footnote, color: colors.textTertiary, marginTop: 4 },
  detailAmt: { ...type.displayAmount, marginTop: spacing.lg },
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
  },
  chipOn: { backgroundColor: colors.accentBlue },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  chipTextOn: { color: colors.textInverse },
  row2: { flexDirection: "row", gap: 10 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: spacing.md,
  },
  detailTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  moreGlyph: { fontSize: 18, color: colors.textSecondary, fontWeight: "700" },
  moreSheet: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.modal,
    padding: spacing.xl,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHairline,
  },
  pickName: { ...type.headline },
  pickMeta: { ...type.footnote, color: colors.textTertiary, marginTop: 2 },
  pickAmt: { ...type.amountList },
  freqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  freqRowOn: { backgroundColor: colors.accentBlueSoft },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  radioOn: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlue,
  },
  freqLabel: { ...type.headline },
  suggested: { ...type.footnote, color: colors.accentBlue, fontWeight: "600" },
});
