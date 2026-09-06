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

const KINDS: RecurringKind[] = ["expense", "income", "reimbursement"];
const CADENCES: RecurringCadence[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
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

  function openCreate() {
    setEditId(null);
    setName("Fake Rent Payment");
    setKind("expense");
    setCadence("monthly");
    setAmount("12000");
    setCurrency("USD");
    setNextDate(new Date().toISOString().slice(0, 10));
    setActive(true);
    setMsg(null);
    setFormOpen(true);
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

  async function onSave() {
    setBusy(true);
    setMsg(null);
    try {
      const id = await upsertRecurringLocal({
        id: editId ?? undefined,
        name: name.trim() || "Recurring",
        kind,
        cadence,
        expected_amount: Number(amount) || 0,
        currency: currency.trim() || "USD",
        category_id: kind === "income" ? "cat-salary" : "cat-other",
        account_id: DEMO_ACCOUNT_ID,
        next_expected_date: nextDate.slice(0, 10),
        active,
      });
      await syncOutbox(createApiTransport()).catch(() => ({ pushed: 0 }));
      setMsg(editId ? "Recurring updated" : "Recurring created");
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
            onPress={openCreate}
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
              onCta={openCreate}
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
      <Text style={styles.detailTitle}>{selected.name}</Text>
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
      <PrimaryButton
        label="Edit recurring"
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
            {editId ? "Edit recurring" : "Add a recurring"}
          </Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Fake Rent Payment"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.fieldLabel}>Kind</Text>
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Pressable
                key={k}
                style={[styles.chip, kind === k && styles.chipOn]}
                onPress={() => setKind(k)}
              >
                <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>
                  {k}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Cadence</Text>
          <View style={styles.chips}>
            {CADENCES.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, cadence === c && styles.chipOn]}
                onPress={() => setCadence(c)}
              >
                <Text
                  style={[styles.chipText, cadence === c && styles.chipTextOn]}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <TextInput
                style={styles.input}
                value={currency}
                onChangeText={setCurrency}
                autoCapitalize="characters"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>
          <Text style={styles.fieldLabel}>Next expected date</Text>
          <TextInput
            style={styles.input}
            value={nextDate}
            onChangeText={setNextDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable
            style={[styles.chip, active && styles.chipOn, { alignSelf: "flex-start" }]}
            onPress={() => setActive((v) => !v)}
          >
            <Text style={[styles.chipText, active && styles.chipTextOn]}>
              {active ? "Active" : "Inactive"}
            </Text>
          </Pressable>
          {msg && formOpen ? <Text style={styles.msg}>{msg}</Text> : null}
          <View style={styles.modalActions}>
            <PrimaryButton
              label="Cancel"
              variant="ghost"
              onPress={() => setFormOpen(false)}
            />
            <PrimaryButton
              label={editId ? "Save" : "Create"}
              onPress={() => void onSave()}
              loading={busy}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

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
});
