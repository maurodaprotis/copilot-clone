import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  DEMO_ACCOUNT_CURRENCY,
  DEMO_ACCOUNT_ID,
  DEMO_REPORTING_CURRENCY,
  API_URL,
} from "../../src/config";
import { addExpenseOffline } from "../../src/offline/addExpenseOffline";
import {
  countOutbox,
  listAllTransactions,
  listToReview,
  type LocalTransaction,
} from "../../src/offline/queries";
import { listCategories } from "../../src/offline/budgets";
import { reviewTransaction } from "../../src/offline/reviewTransaction";
import {
  assignTagLocal,
  equalSplitAmounts,
  listSplitLegsLocal,
  listTags,
  listTxnTagIds,
  setSplitLocal,
  unassignTagLocal,
} from "../../src/offline/rulesTagsSplits";
import type { Tag } from "@copilot-clone/domain";
import { syncOutbox } from "../../src/offline/syncOutbox";
import { createApiTransport } from "../../src/sync/apiTransport";
import { colors, radius, spacing, type } from "../../src/theme";
import {
  Card,
  Chip,
  EmptyState,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionHeader,
} from "../../src/ui";

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function TransactionsScreen() {
  const [pending, setPending] = useState<LocalTransaction[]>([]);
  const [all, setAll] = useState<LocalTransaction[]>([]);
  const [outboxCount, setOutboxCount] = useState(0);
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("Café offline");
  const [currency, setCurrency] = useState("USD");
  const [categoryId, setCategoryId] = useState("cat-dining");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  const [detail, setDetail] = useState<LocalTransaction | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [txnTagIds, setTxnTagIds] = useState<string[]>([]);
  const [splitCatA, setSplitCatA] = useState("cat-dining");
  const [splitCatB, setSplitCatB] = useState("cat-groceries");
  const [splitMsg, setSplitMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [p, a, o, cats, tags] = await Promise.all([
      listToReview(),
      listAllTransactions(),
      countOutbox(),
      listCategories(),
      listTags(),
    ]);
    setPending(p);
    setAll(a);
    setOutboxCount(o);
    const names: Record<string, string> = {};
    for (const c of cats) names[c.id] = `${c.emoji} ${c.name}`;
    setCategoryNames(names);
    setAllTags(tags);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function openDetail(txn: LocalTransaction) {
    setDetail(txn);
    setSplitMsg(null);
    setTxnTagIds(await listTxnTagIds(txn.id));
    const legs = await listSplitLegsLocal(txn.id);
    if (legs.length >= 2) {
      setSplitCatA(legs[0]!.category_id);
      setSplitCatB(legs[1]!.category_id);
    }
  }

  async function toggleTag(tagId: string) {
    if (!detail) return;
    setBusy(true);
    try {
      if (txnTagIds.includes(tagId)) {
        await unassignTagLocal(detail.id, tagId);
      } else {
        await assignTagLocal(detail.id, tagId);
      }
      await syncOutbox(createApiTransport());
      setTxnTagIds(await listTxnTagIds(detail.id));
    } finally {
      setBusy(false);
    }
  }

  async function onEqualSplit() {
    if (!detail) return;
    setBusy(true);
    setSplitMsg(null);
    try {
      const amounts = equalSplitAmounts(detail.amount, 2);
      await setSplitLocal({
        transaction_id: detail.id,
        parent_amount: detail.amount,
        legs: [
          { category_id: splitCatA, amount: amounts[0]! },
          { category_id: splitCatB, amount: amounts[1]! },
        ],
      });
      await syncOutbox(createApiTransport());
      setSplitMsg(`Split ${amounts[0]} / ${amounts[1]}`);
      await reload();
    } catch (e) {
      setSplitMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddOffline() {
    setBusy(true);
    setMsg(null);
    try {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        setMsg("Enter a positive amount");
        return;
      }
      const { transactionId } = await addExpenseOffline({
        account_id: DEMO_ACCOUNT_ID,
        category_id: categoryId,
        amount: n,
        currency,
        account_currency: DEMO_ACCOUNT_CURRENCY,
        reporting_currency: DEMO_REPORTING_CURRENCY,
        note: note || null,
        rate_book: { "USD:ARS:2026-09-04": 1400 },
      });
      setMsg(`Added ${transactionId.slice(0, 8)}…`);
      setShowComposer(false);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSync() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await syncOutbox(createApiTransport());
      setMsg(result.pushed > 0 ? `Synced ${result.pushed}` : "Outbox empty");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReview(id: string) {
    setBusy(true);
    try {
      await reviewTransaction(id);
      await syncOutbox(createApiTransport());
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={false} onRefresh={() => void reload()}>
      <ScreenHeader
        title="Transactions"
        subtitle={outboxCount ? `${outboxCount} in outbox` : "Inbox & history"}
        right={
          <View style={styles.headerActions}>
            <PrimaryButton
              label="Sync"
              variant="ghost"
              onPress={() => void onSync()}
              loading={busy}
              style={styles.smallBtn}
            />
            <PrimaryButton
              label="+ Add"
              onPress={() => setShowComposer((v) => !v)}
              style={styles.smallBtn}
            />
          </View>
        }
      />

      {showComposer ? (
        <Card style={styles.composer}>
          <Text style={styles.composerTitle}>New expense</Text>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.label}>Currency</Text>
          <TextInput
            style={styles.input}
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Merchant or note"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"].map(
              (id) => (
                <Chip
                  key={id}
                  label={categoryNames[id] ?? id}
                  selected={categoryId === id}
                  onPress={() => setCategoryId(id)}
                />
              ),
            )}
          </View>
          <PrimaryButton
            label="Save offline"
            onPress={() => void onAddOffline()}
            loading={busy}
          />
        </Card>
      ) : null}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <SectionHeader title="To Review" count={pending.length} />
      {pending.length === 0 ? (
        <Card>
          <EmptyState
            icon="📥"
            title="Nothing to review"
            body="New imports and offline expenses land here until you confirm them."
            ctaLabel="Add expense"
            onCta={() => setShowComposer(true)}
          />
        </Card>
      ) : (
        pending.map((txn) => (
          <Card key={txn.id} padded={false} style={styles.txnCard}>
            <Pressable
              style={styles.txnRow}
              onPress={() => void openDetail(txn)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.txnName}>{txn.note || "Expense"}</Text>
                <Text style={styles.txnMeta}>
                  {txn.category_id
                    ? categoryNames[txn.category_id] ?? txn.category_id
                    : "Uncategorized"}
                  {txn.synced ? "" : " · pending sync"}
                </Text>
              </View>
              <Text style={styles.txnAmount}>
                {money(txn.amount, txn.currency)}
              </Text>
              <PrimaryButton
                label="Review"
                variant="secondary"
                onPress={() => void onReview(txn.id)}
                style={styles.reviewBtn}
              />
            </Pressable>
          </Card>
        ))
      )}

      <SectionHeader title="All" count={all.length} />
      {all.length === 0 ? (
        <Card>
          <EmptyState
            icon="💳"
            title="No transactions yet"
            body="Add an offline expense or import a bank CSV to get started."
            ctaLabel="Add expense"
            onCta={() => setShowComposer(true)}
          />
        </Card>
      ) : (
        all.map((txn) => (
          <Card key={`all-${txn.id}`} padded={false} style={styles.txnCard}>
            <Pressable
              style={styles.txnRow}
              onPress={() => void openDetail(txn)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.txnName}>{txn.note || "—"}</Text>
                <Text style={styles.txnMeta}>
                  {txn.review_status}
                  {txn.category_id
                    ? ` · ${categoryNames[txn.category_id] ?? txn.category_id}`
                    : ""}
                </Text>
              </View>
              <Text style={styles.txnAmount}>
                {money(txn.amount, txn.currency)}
              </Text>
            </Pressable>
          </Card>
        ))
      )}

      <Text style={styles.apiHint}>{API_URL.replace("https://", "")}</Text>

      <Modal visible={!!detail} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {detail ? money(detail.amount, detail.currency) : ""}
            </Text>
            <Text style={styles.txnMeta}>{detail?.note || "Transaction"}</Text>

            <Text style={[styles.label, { marginTop: spacing.md }]}>Tags</Text>
            <View style={styles.chipRow}>
              {allTags.length === 0 ? (
                <Text style={styles.txnMeta}>Create tags in More → Tags</Text>
              ) : (
                allTags.map((t) => (
                  <Chip
                    key={t.id}
                    label={t.name}
                    selected={txnTagIds.includes(t.id)}
                    onPress={() => void toggleTag(t.id)}
                  />
                ))
              )}
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>
              Equal 2-way split
            </Text>
            <View style={styles.chipRow}>
              {["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"].map(
                (id) => (
                  <Chip
                    key={`a-${id}`}
                    label={`A: ${categoryNames[id] ?? id}`}
                    selected={splitCatA === id}
                    onPress={() => setSplitCatA(id)}
                  />
                ),
              )}
            </View>
            <View style={styles.chipRow}>
              {["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"].map(
                (id) => (
                  <Chip
                    key={`b-${id}`}
                    label={`B: ${categoryNames[id] ?? id}`}
                    selected={splitCatB === id}
                    onPress={() => setSplitCatB(id)}
                  />
                ),
              )}
            </View>
            <PrimaryButton
              label="Save equal split"
              variant="secondary"
              onPress={() => void onEqualSplit()}
              loading={busy}
              style={{ marginTop: spacing.sm }}
            />
            {splitMsg ? <Text style={styles.msg}>{splitMsg}</Text> : null}

            <PrimaryButton
              label="Close"
              variant="ghost"
              onPress={() => setDetail(null)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", gap: spacing.xs },
  smallBtn: { minHeight: 36, paddingVertical: 8, minWidth: 64 },
  composer: { marginBottom: spacing.md },
  composerTitle: { ...type.headline, marginBottom: spacing.sm },
  label: { ...type.footnote, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.chipBg,
    color: colors.text,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  msg: { ...type.footnote, color: colors.text, marginBottom: spacing.sm },
  txnCard: { marginBottom: spacing.sm },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  txnName: { ...type.headline },
  txnMeta: { ...type.footnote, marginTop: 2 },
  txnAmount: { ...type.money },
  reviewBtn: { minWidth: 84, minHeight: 36, paddingVertical: 8 },
  apiHint: {
    ...type.caption,
    textAlign: "center",
    marginTop: spacing.xl,
    color: colors.textTertiary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: "88%",
  },
  modalTitle: { ...type.title2, marginBottom: 4 },
});
